-- APP PET · schema inicial (MVP)
-- 19 tabelas, todas com petshop_id e RLS por pet shop.
-- As regras de negócio do protótipo (src/domain/rules.ts) estão aqui como triggers:
--   * transição de status validada e registrada em atendimento_eventos
--   * finalizar: baixa de 1 uso no plano OU receita pendente, comissão, última visita
--   * conflito de horário bloqueado por exclusion constraint
--   * pagamento de receita marca o atendimento como pago

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type papel as enum ('dono', 'recepcao', 'banhista');
create type porte as enum ('P', 'M', 'G', 'GG');
create type especie as enum ('cao', 'gato');
create type status_atendimento as enum ('agendado', 'confirmado', 'em_atendimento', 'finalizado', 'cancelado', 'faltou');
create type origem_atendimento as enum ('balcao', 'portal');
create type forma_pagamento as enum ('dinheiro', 'debito', 'credito', 'pix', 'transferencia');
create type status_plano as enum ('ativo', 'finalizado', 'vencido', 'cancelado');
create type tipo_lancamento as enum ('receita', 'despesa');
create type status_lancamento as enum ('pendente', 'pago');
create type gatilho_mensagem as enum ('confirmacao', 'lembrete', 'pet_pronto', 'feedback', 'renovacao_plano', 'cliente_sumido');
create type canal_mensagem as enum ('manual', 'api');
create type categoria_servico as enum ('banho', 'tosa', 'estetica', 'outros');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table petshops (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  whatsapp text,
  endereco text,
  fuso text not null default 'America/Sao_Paulo',
  dias_abertos smallint[] not null default '{1,2,3,4,5,6}',
  abre time not null default '08:00',
  fecha time not null default '18:00',
  capacidade_simultanea smallint not null default 1,
  falta_consome_uso boolean not null default false,
  dias_cliente_sumido smallint not null default 30,
  criado_em timestamptz not null default now()
);

create table membros (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  user_id uuid references auth.users on delete set null,
  nome text not null,
  papel papel not null,
  comissao_pct numeric(5,2) not null default 0 check (comissao_pct between 0 and 100),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (petshop_id, user_id)
);

create table tutores (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  nome text not null,
  whatsapp text not null check (whatsapp ~ '^[0-9]{12,13}$'),
  email text,
  endereco text,
  origem text,
  consentimento_whatsapp_em timestamptz,
  etiquetas text[] not null default '{}',
  user_id uuid references auth.users on delete set null, -- portal do tutor (V2)
  criado_em timestamptz not null default now(),
  unique (petshop_id, whatsapp)
);

create table pets (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  tutor_id uuid not null references tutores on delete cascade,
  nome text not null,
  especie especie not null default 'cao',
  raca text,
  porte porte not null,
  sexo char(1) check (sexo in ('M', 'F')),
  nascimento date,
  peso_kg numeric(5,2),
  pelagem text,
  temperamento text,
  alergias text,
  cuidados text,
  observacoes text,
  foto_path text,
  ultima_visita date,
  criado_em timestamptz not null default now()
);

create table servicos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  nome text not null,
  categoria categoria_servico not null default 'outros',
  descricao text,
  comissao_pct numeric(5,2) not null default 0 check (comissao_pct between 0 and 100),
  ativo boolean not null default true
);

create table servico_precos (
  petshop_id uuid not null references petshops on delete cascade,
  servico_id uuid not null references servicos on delete cascade,
  porte porte not null,
  preco numeric(10,2) not null check (preco >= 0),
  duracao_min smallint not null check (duracao_min > 0),
  primary key (servico_id, porte)
);

create table planos_modelo (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  nome text not null,
  servico_ids uuid[] not null,
  quantidade_usos smallint not null check (quantidade_usos > 0),
  validade_dias smallint not null check (validade_dias > 0),
  preco numeric(10,2) not null check (preco >= 0),
  ativo boolean not null default true
);

create table planos_pet (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  modelo_id uuid references planos_modelo on delete set null,
  nome text not null,
  pet_id uuid not null references pets on delete cascade,
  tutor_id uuid not null references tutores on delete cascade,
  servico_ids uuid[] not null,
  total_usos smallint not null check (total_usos > 0),
  preco numeric(10,2) not null check (preco >= 0),
  inicio date not null,
  vencimento date not null,
  status status_plano not null default 'ativo',
  observacoes text,
  criado_em timestamptz not null default now(),
  check (vencimento >= inicio)
);
-- Um pet tem no máximo um plano ativo.
create unique index planos_pet_um_ativo on planos_pet (pet_id) where status = 'ativo';

create table atendimentos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  pet_id uuid not null references pets on delete cascade,
  tutor_id uuid not null references tutores on delete cascade,
  profissional_id uuid not null references membros,
  inicio timestamptz not null,
  fim timestamptz not null,
  status status_atendimento not null default 'agendado',
  origem origem_atendimento not null default 'balcao',
  valor_total numeric(10,2) not null default 0 check (valor_total >= 0),
  desconto numeric(10,2) not null default 0 check (desconto >= 0),
  plano_pet_id uuid references planos_pet on delete set null,
  pago boolean not null default false,
  observacoes text,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  check (fim > inicio),
  -- Conflito de horário: o mesmo profissional não tem dois atendimentos sobrepostos.
  constraint atendimentos_sem_conflito exclude using gist (
    profissional_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status <> 'cancelado' and status <> 'faltou')
);

create table atendimento_itens (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  atendimento_id uuid not null references atendimentos on delete cascade,
  servico_id uuid not null references servicos,
  nome text not null,
  preco numeric(10,2) not null check (preco >= 0),
  duracao_min smallint not null,
  coberto_por_plano boolean not null default false
);

create table atendimento_eventos (
  id bigint generated always as identity primary key,
  petshop_id uuid not null references petshops on delete cascade,
  atendimento_id uuid not null references atendimentos on delete cascade,
  de status_atendimento,
  para status_atendimento not null,
  membro_id uuid references membros,
  em timestamptz not null default now()
);

create table atendimento_fotos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  atendimento_id uuid not null references atendimentos on delete cascade,
  tipo text not null check (tipo in ('antes', 'depois')),
  storage_path text not null,
  criado_em timestamptz not null default now()
);

create table plano_usos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  plano_pet_id uuid not null references planos_pet on delete cascade,
  atendimento_id uuid references atendimentos on delete set null,
  em timestamptz not null default now(),
  estornado boolean not null default false
);
-- Um atendimento consome no máximo um uso.
create unique index plano_usos_um_por_atendimento on plano_usos (atendimento_id) where atendimento_id is not null and not estornado;

create table mensagem_modelos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  gatilho gatilho_mensagem not null,
  titulo text not null,
  texto text not null,
  ativo boolean not null default true,
  antecedencia_horas smallint,
  unique (petshop_id, gatilho)
);

create table mensagens_envios (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  modelo_id uuid references mensagem_modelos on delete set null,
  tutor_id uuid not null references tutores on delete cascade,
  atendimento_id uuid references atendimentos on delete set null,
  canal canal_mensagem not null default 'manual',
  status text not null default 'enviado',
  enviado_em timestamptz not null default now()
);

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  tipo tipo_lancamento not null,
  categoria text not null,
  descricao text not null,
  valor numeric(10,2) not null check (valor > 0),
  forma_pagamento forma_pagamento,
  status status_lancamento not null default 'pendente',
  competencia date not null,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  atendimento_id uuid references atendimentos on delete set null,
  plano_pet_id uuid references planos_pet on delete set null,
  check (status = 'pendente' or (pago_em is not null and forma_pagamento is not null))
);

create table caixas (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  data date not null,
  saldo_inicial numeric(10,2) not null default 0,
  entradas numeric(10,2) not null,
  saidas numeric(10,2) not null,
  saldo_final numeric(10,2) not null,
  fechado_por uuid references membros,
  fechado_em timestamptz not null default now(),
  unique (petshop_id, data)
);

create table comissoes (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  membro_id uuid not null references membros,
  atendimento_item_id uuid not null references atendimento_itens on delete cascade unique,
  valor numeric(10,2) not null check (valor >= 0),
  status text not null default 'a_pagar' check (status in ('a_pagar', 'pago')),
  criado_em timestamptz not null default now()
);

create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade unique,
  plano text not null,
  status text not null default 'trial' check (status in ('trial', 'ativa', 'inadimplente', 'cancelada')),
  gateway_id text,
  proximo_vencimento date,
  criado_em timestamptz not null default now()
);

-- Índices de leitura frequente
create index on atendimentos (petshop_id, inicio);
create index on atendimentos (pet_id, inicio desc);
create index on atendimento_itens (atendimento_id);
create index on pets (tutor_id);
create index on tutores (petshop_id, nome);
create index on plano_usos (plano_pet_id);
create index on lancamentos (petshop_id, status, competencia);
create index on lancamentos (petshop_id, pago_em);

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

create function meus_petshops() returns setof uuid
language sql stable security definer set search_path = public as $$
  select petshop_id from membros where user_id = auth.uid() and ativo
$$;

create function tem_papel(p_petshop uuid, p_papeis papel[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros
    where petshop_id = p_petshop and user_id = auth.uid() and ativo and papel = any (p_papeis)
  )
$$;

create function membro_atual(p_petshop uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from membros where petshop_id = p_petshop and user_id = auth.uid() and ativo limit 1
$$;

create function saldo_plano(p_plano uuid) returns integer
language sql stable set search_path = public as $$
  select pp.total_usos - (
    select count(*) from plano_usos u where u.plano_pet_id = pp.id and not u.estornado
  )::int
  from planos_pet pp where pp.id = p_plano
$$;

create function transicao_valida(de status_atendimento, para status_atendimento) returns boolean
language sql immutable as $$
  select case de
    when 'agendado' then para in ('confirmado', 'em_atendimento', 'cancelado', 'faltou')
    when 'confirmado' then para in ('em_atendimento', 'cancelado', 'faltou')
    when 'em_atendimento' then para = 'finalizado'
    else false
  end
$$;

-- Saldo e status efetivo (vencido por data) prontos para a tela de planos.
create view planos_pet_saldo with (security_invoker = true) as
select
  pp.*,
  saldo_plano(pp.id) as saldo,
  case
    when pp.status <> 'ativo' then pp.status
    when saldo_plano(pp.id) = 0 then 'finalizado'::status_plano
    when pp.vencimento < current_date then 'vencido'::status_plano
    else 'ativo'::status_plano
  end as status_efetivo
from planos_pet pp;

-- ---------------------------------------------------------------------------
-- Triggers de regra de negócio
-- ---------------------------------------------------------------------------

-- Registra o status inicial.
create function atendimento_evento_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into atendimento_eventos (petshop_id, atendimento_id, de, para, membro_id)
  values (new.petshop_id, new.id, null, new.status, membro_atual(new.petshop_id));
  return new;
end $$;

create trigger atendimentos_after_insert after insert on atendimentos
for each row execute function atendimento_evento_inicial();

-- Valida a transição e aplica os efeitos (plano, financeiro, comissão, última visita).
create function atendimento_mudou_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ps petshops%rowtype;
  v_cobre boolean;
  v_pet text;
  v_servicos text;
begin
  if not transicao_valida(old.status, new.status) then
    raise exception 'Não é possível passar de % para %', old.status, new.status using errcode = 'P0001';
  end if;

  select * into v_ps from petshops where id = new.petshop_id;
  select exists (select 1 from atendimento_itens where atendimento_id = new.id and coberto_por_plano) into v_cobre;

  -- Consumo do plano: ao finalizar, ou na falta quando o pet shop configura.
  if new.plano_pet_id is not null and v_cobre
     and (new.status = 'finalizado' or (new.status = 'faltou' and v_ps.falta_consome_uso)) then
    if saldo_plano(new.plano_pet_id) > 0 then
      insert into plano_usos (petshop_id, plano_pet_id, atendimento_id) values (new.petshop_id, new.plano_pet_id, new.id);
    else
      -- O plano zerou entre o agendamento e a finalização: cobra normalmente.
      update atendimento_itens set coberto_por_plano = false where atendimento_id = new.id;
      new.valor_total := greatest(0, (select coalesce(sum(preco), 0) from atendimento_itens where atendimento_id = new.id) - new.desconto);
      new.plano_pet_id := null;
    end if;
  end if;

  if new.status = 'finalizado' then
    if new.valor_total > 0 then
      select nome into v_pet from pets where id = new.pet_id;
      select string_agg(nome, ' + ' order by nome) into v_servicos from atendimento_itens where atendimento_id = new.id;
      insert into lancamentos (petshop_id, tipo, categoria, descricao, valor, status, competencia, atendimento_id)
      values (new.petshop_id, 'receita', 'Serviços', v_pet || ' · ' || v_servicos, new.valor_total, 'pendente',
              (new.inicio at time zone v_ps.fuso)::date, new.id);
    else
      new.pago := true;
    end if;

    -- Comissão por item (sobre o preço de tabela; decisão em aberto para itens de plano).
    insert into comissoes (petshop_id, membro_id, atendimento_item_id, valor)
    select new.petshop_id, new.profissional_id, i.id, round(i.preco * s.comissao_pct / 100, 2)
    from atendimento_itens i join servicos s on s.id = i.servico_id
    where i.atendimento_id = new.id and s.comissao_pct > 0;

    update pets set ultima_visita = (new.inicio at time zone v_ps.fuso)::date where id = new.pet_id;
  end if;

  insert into atendimento_eventos (petshop_id, atendimento_id, de, para, membro_id)
  values (new.petshop_id, new.id, old.status, new.status, membro_atual(new.petshop_id));
  return new;
end $$;

create trigger atendimentos_before_status before update of status on atendimentos
for each row when (old.status is distinct from new.status)
execute function atendimento_mudou_status();

-- Receita paga marca o atendimento como pago.
create function lancamento_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.atendimento_id is not null then
    update atendimentos set pago = true where id = new.atendimento_id;
  end if;
  return new;
end $$;

create trigger lancamentos_after_pago after update of status on lancamentos
for each row when (old.status = 'pendente' and new.status = 'pago')
execute function lancamento_pago();

-- Saldo zerado encerra o plano; estorno reabre.
create function plano_sincroniza_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_saldo integer;
begin
  v_saldo := saldo_plano(new.plano_pet_id);
  update planos_pet set status = 'finalizado' where id = new.plano_pet_id and status = 'ativo' and v_saldo = 0;
  update planos_pet set status = 'ativo' where id = new.plano_pet_id and status = 'finalizado' and v_saldo > 0;
  return new;
end $$;

create trigger plano_usos_after_change after insert or update of estornado on plano_usos
for each row execute function plano_sincroniza_status();

-- Onboarding: cria o pet shop e vincula quem criou como dono.
create function criar_petshop(p_nome text, p_slug text, p_whatsapp text default null, p_dono_nome text default null)
returns petshops
language plpgsql security definer set search_path = public as $$
declare v petshops;
begin
  if auth.uid() is null then
    raise exception 'Faça login para criar um pet shop' using errcode = '42501';
  end if;
  insert into petshops (nome, slug, whatsapp) values (p_nome, p_slug, p_whatsapp) returning * into v;
  insert into membros (petshop_id, user_id, nome, papel)
  values (v.id, auth.uid(), coalesce(nullif(trim(p_dono_nome), ''), (select email from auth.users where id = auth.uid()), 'Dono'), 'dono');
  return v;
end $$;

-- Agendamento atômico: atendimento + itens numa transação (RLS do chamador vale).
create function criar_atendimento(p_atendimento jsonb, p_itens jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into atendimentos (id, petshop_id, pet_id, tutor_id, profissional_id, inicio, fim, origem, valor_total, desconto, plano_pet_id, observacoes)
  select coalesce(a.id, gen_random_uuid()), a.petshop_id, a.pet_id, a.tutor_id, a.profissional_id, a.inicio, a.fim,
         coalesce(a.origem, 'balcao'), a.valor_total, coalesce(a.desconto, 0), a.plano_pet_id, a.observacoes
  from jsonb_populate_record(null::atendimentos, p_atendimento) a
  returning id into v_id;

  insert into atendimento_itens (petshop_id, atendimento_id, servico_id, nome, preco, duracao_min, coberto_por_plano)
  select (p_atendimento->>'petshop_id')::uuid, v_id, i.servico_id, i.nome, i.preco, i.duracao_min, coalesce(i.coberto_por_plano, false)
  from jsonb_populate_recordset(null::atendimento_itens, p_itens) i;
  return v_id;
end $$;

-- Venda de plano atômica: plano + receita.
create function vender_plano(p_plano jsonb, p_lancamento jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into planos_pet select * from jsonb_populate_record(null::planos_pet, p_plano || jsonb_build_object('criado_em', now(), 'status', 'ativo'))
  returning id into v_id;
  insert into lancamentos select * from jsonb_populate_record(null::lancamentos, p_lancamento || jsonb_build_object('plano_pet_id', v_id, 'criado_em', now()));
  return v_id;
end $$;

-- Fecha o caixa do dia com os totais calculados no banco.
create function fechar_caixa(p_petshop uuid, p_data date) returns caixas
language plpgsql security definer set search_path = public as $$
declare
  v_fuso text;
  v_ent numeric(10,2);
  v_sai numeric(10,2);
  v_cx caixas;
begin
  if not tem_papel(p_petshop, '{dono,recepcao}') then
    raise exception 'Sem permissão para fechar o caixa' using errcode = '42501';
  end if;
  select fuso into v_fuso from petshops where id = p_petshop;
  select
    coalesce(sum(valor) filter (where tipo = 'receita'), 0),
    coalesce(sum(valor) filter (where tipo = 'despesa'), 0)
  into v_ent, v_sai
  from lancamentos
  where petshop_id = p_petshop and status = 'pago' and (pago_em at time zone v_fuso)::date = p_data;

  insert into caixas (petshop_id, data, entradas, saidas, saldo_final, fechado_por)
  values (p_petshop, p_data, v_ent, v_sai, v_ent - v_sai, membro_atual(p_petshop))
  returning * into v_cx;
  return v_cx;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table petshops enable row level security;
alter table membros enable row level security;
alter table tutores enable row level security;
alter table pets enable row level security;
alter table servicos enable row level security;
alter table servico_precos enable row level security;
alter table planos_modelo enable row level security;
alter table planos_pet enable row level security;
alter table atendimentos enable row level security;
alter table atendimento_itens enable row level security;
alter table atendimento_eventos enable row level security;
alter table atendimento_fotos enable row level security;
alter table plano_usos enable row level security;
alter table mensagem_modelos enable row level security;
alter table mensagens_envios enable row level security;
alter table lancamentos enable row level security;
alter table caixas enable row level security;
alter table comissoes enable row level security;
alter table assinaturas enable row level security;

-- Pet shop: membros leem, dono edita. Criação só pelo RPC criar_petshop.
create policy petshops_ler on petshops for select to authenticated using (id in (select meus_petshops()));
create policy petshops_editar on petshops for update to authenticated using (tem_papel(id, '{dono}'));

-- Equipe: membros leem; dono gerencia.
create policy membros_ler on membros for select to authenticated using (petshop_id in (select meus_petshops()));
create policy membros_gerir on membros for all to authenticated using (tem_papel(petshop_id, '{dono}')) with check (tem_papel(petshop_id, '{dono}'));

-- Operação: qualquer membro ativo do pet shop.
do $$
declare t text;
begin
  foreach t in array array[
    'tutores', 'pets', 'servicos', 'servico_precos', 'planos_modelo', 'planos_pet', 'atendimentos',
    'atendimento_itens', 'atendimento_eventos', 'atendimento_fotos', 'plano_usos',
    'mensagem_modelos', 'mensagens_envios'
  ] loop
    execute format(
      'create policy %1$s_membros on %1$I for all to authenticated
         using (petshop_id in (select meus_petshops()))
         with check (petshop_id in (select meus_petshops()))', t);
  end loop;
end $$;

-- Dinheiro: só dono e recepção.
create policy lancamentos_gestao on lancamentos for all to authenticated
  using (tem_papel(petshop_id, '{dono,recepcao}')) with check (tem_papel(petshop_id, '{dono,recepcao}'));
create policy caixas_gestao on caixas for all to authenticated
  using (tem_papel(petshop_id, '{dono,recepcao}')) with check (tem_papel(petshop_id, '{dono,recepcao}'));
create policy assinaturas_dono on assinaturas for select to authenticated using (tem_papel(petshop_id, '{dono}'));

-- Comissões: gestão vê todas; banhista vê só as dele.
create policy comissoes_gestao on comissoes for all to authenticated
  using (tem_papel(petshop_id, '{dono}')) with check (tem_papel(petshop_id, '{dono}'));
create policy comissoes_propria on comissoes for select to authenticated
  using (membro_id = membro_atual(petshop_id));

-- Funções expostas só para usuários logados.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
