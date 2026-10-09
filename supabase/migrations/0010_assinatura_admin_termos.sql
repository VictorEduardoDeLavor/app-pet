-- APP PET · 0010 · Assinatura do SaaS (teste grátis + Asaas), painel do administrador e aceite dos termos
--
-- Regra de acesso: o pet shop usa o app enquanto estiver no teste grátis, com a mensalidade paga
-- (mais 3 dias de tolerância) ou liberado à mão pelo administrador. Fora disso, as tabelas de
-- operação ficam fechadas pelo RLS; dono e equipe continuam vendo o pet shop e a assinatura
-- para regularizar. Os dados nunca são apagados.

-- ---------------------------------------------------------------------------
-- Assinatura (a tabela já existe desde a 0001, vazia)
-- ---------------------------------------------------------------------------

-- Sem comandos destrutivos: o status segue com os 4 valores da 0001 e o bloqueio manual vira uma coluna.
alter table assinaturas
  alter column plano set default 'mensal',
  add column bloqueada boolean not null default false,
  add column valor numeric(10,2) not null default 49 check (valor >= 0),
  add column teste_ate timestamptz not null default now() + interval '14 days',
  add column pago_ate date,
  add column liberado_ate date,
  add column documento text check (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  add column email_cobranca text,
  add column asaas_customer_id text,
  add column asaas_subscription_id text unique,
  add column cancelada_em timestamptz,
  add column atualizado_em timestamptz not null default now();

-- Cobranças mensais vindas do Asaas (uma linha por cobrança).
create table assinatura_pagamentos (
  asaas_id text primary key,
  petshop_id uuid not null references petshops on delete cascade,
  valor numeric(10,2) not null,
  vencimento date not null,
  status text not null,
  forma text,
  link text,
  pago_em date,
  atualizado_em timestamptz not null default now()
);
create index assinatura_pagamentos_petshop_idx on assinatura_pagamentos (petshop_id, vencimento desc);
alter table assinatura_pagamentos enable row level security;

-- Eventos recebidos do webhook (idempotência e auditoria). Só o servidor lê e grava.
create table asaas_eventos (
  id text primary key,
  evento text not null,
  payload jsonb not null,
  petshop_id uuid references petshops on delete set null,
  recebido_em timestamptz not null default now()
);
alter table asaas_eventos enable row level security;

-- Administradores da plataforma (o Victor). Sem policies: só as funções abaixo leem.
create table plataforma_admins (
  user_id uuid primary key references auth.users on delete cascade,
  criado_em timestamptz not null default now()
);
alter table plataforma_admins enable row level security;

-- Aceite dos termos de uso e da política de privacidade pelo dono.
alter table petshops
  add column termos_versao text,
  add column termos_aceitos_em timestamptz,
  add column termos_aceitos_por uuid references auth.users on delete set null;

-- Todo pet shop nasce com 14 dias de teste.
create function petshop_cria_assinatura() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into assinaturas (petshop_id, plano, status, valor, teste_ate)
  values (new.id, 'mensal', 'trial', 49, now() + interval '14 days')
  on conflict (petshop_id) do nothing;
  return new;
end $$;

create trigger petshops_after_insert_assinatura after insert on petshops
for each row execute function petshop_cria_assinatura();

-- Pet shops que já existiam ganham o teste a partir de hoje.
insert into assinaturas (petshop_id, plano, status, valor, teste_ate)
select id, 'mensal', 'trial', 49, now() + interval '14 days' from petshops
on conflict (petshop_id) do nothing;

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------

create function assinatura_liberada(p_petshop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- Sem linha de assinatura (não deveria acontecer): não trava ninguém.
  select coalesce((
    select (not a.bloqueada and (
      a.teste_ate >= now()
      or a.pago_ate + 3 >= current_date
      or a.liberado_ate >= current_date
    )) is true
    from assinaturas a where a.petshop_id = p_petshop
  ), true)
$$;

-- Todos os pet shops da pessoa, liberados ou não (para ver o pet shop e regularizar).
create function meus_petshops_todos() returns setof uuid
language sql stable security definer set search_path = public as $$
  select petshop_id from membros where user_id = auth.uid() and ativo
$$;

-- Só os liberados: é o que abre as tabelas de operação.
create or replace function meus_petshops() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.petshop_id from membros m
  where m.user_id = auth.uid() and m.ativo and assinatura_liberada(m.petshop_id)
$$;

create or replace function tem_papel(p_petshop uuid, p_papeis papel[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros
    where petshop_id = p_petshop and user_id = auth.uid() and ativo and papel = any (p_papeis)
  ) and assinatura_liberada(p_petshop)
$$;

create function sou_dono(p_petshop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where petshop_id = p_petshop and user_id = auth.uid() and ativo and papel = 'dono')
$$;

alter policy petshops_ler on petshops using (id in (select meus_petshops_todos()));
alter policy membros_ler on membros using (petshop_id in (select meus_petshops_todos()));
alter policy assinaturas_dono on assinaturas using (sou_dono(petshop_id));
create policy assinatura_pagamentos_dono on assinatura_pagamentos for select to authenticated using (sou_dono(petshop_id));

-- Situação da assinatura para qualquer membro; detalhes de cobrança só para o dono.
create function minha_assinatura(p_petshop uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a assinaturas%rowtype;
  v_dono boolean;
begin
  if not exists (select 1 from membros where petshop_id = p_petshop and user_id = auth.uid() and ativo) then
    raise exception 'Sem acesso a este pet shop' using errcode = '42501';
  end if;
  select * into a from assinaturas where petshop_id = p_petshop;
  v_dono := sou_dono(p_petshop);
  return jsonb_build_object(
    'liberado', assinatura_liberada(p_petshop),
    'status', case when a.bloqueada then 'bloqueada' else coalesce(a.status, 'ativa') end,
    'teste_ate', a.teste_ate,
    'pago_ate', a.pago_ate,
    'liberado_ate', a.liberado_ate,
    'valor', a.valor,
    'dono', v_dono,
    'termos_versao', (select termos_versao from petshops where id = p_petshop)
  ) || case when v_dono then jsonb_build_object(
    'documento', a.documento,
    'email_cobranca', a.email_cobranca,
    'assinada', a.asaas_subscription_id is not null and a.status <> 'cancelada',
    'cancelada_em', a.cancelada_em,
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.asaas_id, 'valor', p.valor, 'vencimento', p.vencimento, 'status', p.status,
        'forma', p.forma, 'link', p.link, 'pago_em', p.pago_em
      ) order by p.vencimento desc)
      from assinatura_pagamentos p where p.petshop_id = p_petshop and p.status <> 'DELETED'
    ), '[]'::jsonb)
  ) else '{}'::jsonb end;
end $$;

-- ---------------------------------------------------------------------------
-- Asaas (chamado só pelas Edge Functions, com a chave de serviço)
-- ---------------------------------------------------------------------------

-- Pago até = vencimento mais recente confirmado + 1 mês. Recalculado a cada evento (idempotente;
-- estorno e cobrança removida voltam a data).
create function assinatura_recalcular(p_petshop uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_ate date;
begin
  select (max(vencimento) + interval '1 month')::date into v_ate
  from assinatura_pagamentos
  where petshop_id = p_petshop and status in ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH');
  update assinaturas set pago_ate = v_ate, atualizado_em = now() where petshop_id = p_petshop;
end $$;

create function asaas_processar_evento(p_evento jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_evento text := p_evento->>'event';
  v_pay jsonb := p_evento->'payment';
  v_sub jsonb := p_evento->'subscription';
  v_ps uuid;
begin
  if p_evento->>'id' is null or v_evento is null then
    raise exception 'Evento sem id' using errcode = '22023';
  end if;
  if exists (select 1 from asaas_eventos where id = p_evento->>'id') then
    return 'repetido';
  end if;

  if v_pay is not null then
    select petshop_id into v_ps from assinaturas
    where asaas_subscription_id = v_pay->>'subscription'
       or (v_pay->>'subscription' is null and asaas_customer_id = v_pay->>'customer')
    limit 1;
    if v_ps is null and v_pay->>'externalReference' ~ '^[0-9a-f-]{36}$' then
      select petshop_id into v_ps from assinaturas where petshop_id = (v_pay->>'externalReference')::uuid;
    end if;
  elsif v_sub is not null then
    select petshop_id into v_ps from assinaturas where asaas_subscription_id = v_sub->>'id';
  end if;

  insert into asaas_eventos (id, evento, payload, petshop_id) values (p_evento->>'id', v_evento, p_evento, v_ps);
  if v_ps is null then
    return 'ignorado';
  end if;

  if v_pay is not null then
    if v_evento = 'PAYMENT_DELETED' then
      -- Cobrança removida no Asaas: fica registrada, mas some da tela e não conta como paga.
      update assinatura_pagamentos set status = 'DELETED', atualizado_em = now() where asaas_id = v_pay->>'id';
    else
      insert into assinatura_pagamentos (asaas_id, petshop_id, valor, vencimento, status, forma, link, pago_em)
      values (
        v_pay->>'id', v_ps, (v_pay->>'value')::numeric, (v_pay->>'dueDate')::date, v_pay->>'status',
        v_pay->>'billingType', v_pay->>'invoiceUrl',
        coalesce(nullif(v_pay->>'clientPaymentDate', ''), nullif(v_pay->>'paymentDate', ''))::date
      )
      on conflict (asaas_id) do update set
        valor = excluded.valor, vencimento = excluded.vencimento, status = excluded.status,
        forma = excluded.forma, link = coalesce(excluded.link, assinatura_pagamentos.link),
        pago_em = coalesce(excluded.pago_em, assinatura_pagamentos.pago_em), atualizado_em = now();
    end if;
    perform assinatura_recalcular(v_ps);

    if v_evento in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') then
      update assinaturas set status = 'ativa', atualizado_em = now()
      where petshop_id = v_ps and status in ('trial', 'inadimplente', 'ativa');
    elsif v_evento = 'PAYMENT_OVERDUE' then
      update assinaturas set status = 'inadimplente', atualizado_em = now()
      where petshop_id = v_ps and status in ('trial', 'ativa');
    end if;
  elsif v_evento in ('SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED') then
    update assinaturas set status = 'cancelada', cancelada_em = coalesce(cancelada_em, now()), atualizado_em = now()
    where petshop_id = v_ps;
  end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------------------
-- Termos de uso e privacidade
-- ---------------------------------------------------------------------------

-- O cadastro chama criar_petshop (igual à 0001) e, em seguida, aceitar_termos com a versão vigente.
create function aceitar_termos(p_petshop uuid, p_versao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_dono(p_petshop) then
    raise exception 'Só o dono aceita os termos pelo pet shop' using errcode = '42501';
  end if;
  update petshops set termos_versao = p_versao, termos_aceitos_em = now(), termos_aceitos_por = auth.uid() where id = p_petshop;
end $$;

-- ---------------------------------------------------------------------------
-- Painel do administrador da plataforma
-- ---------------------------------------------------------------------------

create function sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where user_id = auth.uid())
$$;

create function admin_petshops() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not sou_admin() then
    raise exception 'Só o administrador' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'whatsapp', p.whatsapp,
      'criado_em', p.criado_em,
      'termos', p.termos_versao,
      'dono', (select m.nome from membros m where m.petshop_id = p.id and m.papel = 'dono' order by m.criado_em limit 1),
      'email', (select u.email from membros m join auth.users u on u.id = m.user_id where m.petshop_id = p.id and m.papel = 'dono' order by m.criado_em limit 1),
      'status', case when a.bloqueada then 'bloqueada' else a.status end,
      'valor', a.valor,
      'teste_ate', a.teste_ate,
      'pago_ate', a.pago_ate,
      'liberado_ate', a.liberado_ate,
      'assinada', a.asaas_subscription_id is not null,
      'liberado', assinatura_liberada(p.id),
      'equipe', (select count(*) from membros m where m.petshop_id = p.id and m.ativo),
      'clientes', (select count(*) from tutores t where t.petshop_id = p.id),
      'pets', (select count(*) from pets x where x.petshop_id = p.id),
      'atendimentos_30d', (select count(*) from atendimentos x where x.petshop_id = p.id and x.inicio >= now() - interval '30 days'),
      'ultimo_atendimento', (select max(x.inicio) from atendimentos x where x.petshop_id = p.id)
    ) order by p.criado_em desc)
    from petshops p left join assinaturas a on a.petshop_id = p.id
  ), '[]'::jsonb);
end $$;

create function admin_ajustar_assinatura(p_petshop uuid, p_acao text, p_valor numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_admin() then
    raise exception 'Só o administrador' using errcode = '42501';
  end if;
  if p_acao = 'estender_teste' then
    update assinaturas set teste_ate = greatest(teste_ate, now()) + make_interval(days => coalesce(p_valor, 7)::int),
      status = 'trial', atualizado_em = now()
    where petshop_id = p_petshop;
  elsif p_acao = 'liberar' then
    update assinaturas set liberado_ate = greatest(coalesce(liberado_ate, current_date), current_date) + coalesce(p_valor, 30)::int,
      atualizado_em = now()
    where petshop_id = p_petshop;
  elsif p_acao = 'bloquear' then
    update assinaturas set bloqueada = true, atualizado_em = now() where petshop_id = p_petshop;
  elsif p_acao = 'desbloquear' then
    update assinaturas set bloqueada = false, atualizado_em = now() where petshop_id = p_petshop;
  elsif p_acao = 'valor' then
    if p_valor is null or p_valor < 0 then
      raise exception 'Informe o valor da mensalidade' using errcode = '22023';
    end if;
    update assinaturas set valor = p_valor, atualizado_em = now() where petshop_id = p_petshop;
  else
    raise exception 'Ação desconhecida: %', p_acao using errcode = '22023';
  end if;
  if not found then
    raise exception 'Pet shop não encontrado' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------------

revoke execute on function petshop_cria_assinatura(), assinatura_recalcular(uuid), asaas_processar_evento(jsonb)
  from public, anon, authenticated;
revoke execute on function assinatura_liberada(uuid), meus_petshops_todos(), sou_dono(uuid), minha_assinatura(uuid),
  aceitar_termos(uuid, text), sou_admin(), admin_petshops(),
  admin_ajustar_assinatura(uuid, text, numeric)
  from public, anon;
grant execute on function assinatura_liberada(uuid), meus_petshops_todos(), sou_dono(uuid), minha_assinatura(uuid),
  aceitar_termos(uuid, text), sou_admin(), admin_petshops(),
  admin_ajustar_assinatura(uuid, text, numeric)
  to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function asaas_processar_evento(jsonb), assinatura_recalcular(uuid) to service_role;
  end if;
end $$;
