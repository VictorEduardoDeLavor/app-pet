-- APP PET · 0007 · Acompanhamento do tutor, etapas com foto, leva e traz com GPS, acerto de comissões
--
-- * papel "motorista" e gatilho de mensagem "acompanhamento" (valores novos nos enums)
-- * atendimentos: token do link do tutor, tipo de transporte, endereço e motorista
-- * atendimento_etapas: momentos com foto (chegou, banho, secagem, tosa, pronto, transporte)
-- * rota_posicoes: posição do carro enquanto o motorista compartilha o GPS
-- * comissao_acertos + registrar_acerto(): pagamento de comissões fecha o período e lança a despesa
-- * bucket "fotos" (público, caminhos aleatórios) com escrita só da equipe do pet shop
-- * acompanhamento(token): o que o tutor vê, sem login

alter type papel add value if not exists 'motorista';
alter type gatilho_mensagem add value if not exists 'acompanhamento';

create type etapa_atendimento as enum (
  'saiu_para_buscar', 'pet_buscado', 'chegou', 'banho', 'secagem', 'tosa', 'pronto', 'saiu_para_entregar', 'entregue'
);

-- ---------------------------------------------------------------------------
-- Atendimentos: link do tutor e leva e traz
-- ---------------------------------------------------------------------------

alter table atendimentos
  add column token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  add column transporte text not null default 'nenhum' check (transporte in ('nenhum', 'busca', 'entrega', 'busca_e_entrega')),
  add column endereco_transporte text,
  add column motorista_id uuid references membros,
  add constraint atendimentos_transporte_endereco check (transporte = 'nenhum' or endereco_transporte is not null);

create index atendimentos_motorista_idx on atendimentos (motorista_id);

-- O agendamento atômico passa a aceitar os campos novos.
create or replace function criar_atendimento(p_atendimento jsonb, p_itens jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into atendimentos (id, petshop_id, pet_id, tutor_id, profissional_id, inicio, fim, origem, valor_total, desconto, plano_pet_id, observacoes,
                            token, transporte, endereco_transporte, motorista_id)
  select coalesce(a.id, gen_random_uuid()), a.petshop_id, a.pet_id, a.tutor_id, a.profissional_id, a.inicio, a.fim,
         coalesce(a.origem, 'balcao'), a.valor_total, coalesce(a.desconto, 0), a.plano_pet_id, a.observacoes,
         coalesce(a.token, replace(gen_random_uuid()::text, '-', '')), coalesce(a.transporte, 'nenhum'), a.endereco_transporte, a.motorista_id
  from jsonb_populate_record(null::atendimentos, p_atendimento) a
  returning id into v_id;

  insert into atendimento_itens (petshop_id, atendimento_id, servico_id, nome, preco, duracao_min, coberto_por_plano)
  select (p_atendimento->>'petshop_id')::uuid, v_id, i.servico_id, i.nome, i.preco, i.duracao_min, coalesce(i.coberto_por_plano, false)
  from jsonb_populate_recordset(null::atendimento_itens, p_itens) i;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Etapas com foto
-- ---------------------------------------------------------------------------

create table atendimento_etapas (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  atendimento_id uuid not null references atendimentos on delete cascade,
  etapa etapa_atendimento not null,
  nota text,
  foto_path text,
  membro_id uuid references membros,
  em timestamptz not null default now()
);
create index atendimento_etapas_atendimento_idx on atendimento_etapas (atendimento_id, em);
create index atendimento_etapas_petshop_idx on atendimento_etapas (petshop_id);
create index atendimento_etapas_membro_idx on atendimento_etapas (membro_id);

alter table atendimento_etapas enable row level security;
create policy atendimento_etapas_membros on atendimento_etapas for all to authenticated
  using (petshop_id in (select meus_petshops())) with check (petshop_id in (select meus_petshops()));

-- Etapas de transporte seguem a ordem (sair → buscar → sair para entregar → entregar) e exigem leva e traz.
create function etapa_valida() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_atd atendimentos%rowtype;
  v_feitas etapa_atendimento[];
  v_busca boolean;
  v_entrega boolean;
begin
  select * into v_atd from atendimentos where id = new.atendimento_id;
  if v_atd.status in ('cancelado', 'faltou') then
    raise exception 'Este atendimento está encerrado.' using errcode = 'P0001';
  end if;
  if new.etapa in ('saiu_para_buscar', 'pet_buscado', 'saiu_para_entregar', 'entregue') then
    if v_atd.transporte = 'nenhum' then
      raise exception 'Este atendimento não tem leva e traz.' using errcode = 'P0001';
    end if;
    select coalesce(array_agg(etapa), '{}') into v_feitas from atendimento_etapas where atendimento_id = new.atendimento_id;
    v_busca := v_atd.transporte in ('busca', 'busca_e_entrega');
    v_entrega := v_atd.transporte in ('entrega', 'busca_e_entrega');
    if new.etapa = 'saiu_para_buscar' and not (v_busca and not ('saiu_para_buscar' = any (v_feitas))) then
      raise exception 'Etapa de transporte fora de ordem.' using errcode = 'P0001';
    elsif new.etapa = 'pet_buscado' and not (v_busca and 'saiu_para_buscar' = any (v_feitas) and not ('pet_buscado' = any (v_feitas))) then
      raise exception 'Etapa de transporte fora de ordem.' using errcode = 'P0001';
    elsif new.etapa = 'saiu_para_entregar' and not (v_entrega and v_atd.status = 'finalizado' and not ('saiu_para_entregar' = any (v_feitas))
          and (not v_busca or 'pet_buscado' = any (v_feitas))) then
      raise exception 'Etapa de transporte fora de ordem.' using errcode = 'P0001';
    elsif new.etapa = 'entregue' and not (v_entrega and 'saiu_para_entregar' = any (v_feitas) and not ('entregue' = any (v_feitas))) then
      raise exception 'Etapa de transporte fora de ordem.' using errcode = 'P0001';
    end if;
  end if;
  if new.membro_id is null then
    new.membro_id := membro_atual(new.petshop_id);
  end if;
  return new;
end $$;
revoke execute on function etapa_valida() from public, anon, authenticated;

create trigger atendimento_etapas_before_insert before insert on atendimento_etapas
for each row execute function etapa_valida();

-- ---------------------------------------------------------------------------
-- Posição do carro (leva e traz)
-- ---------------------------------------------------------------------------

create table rota_posicoes (
  id bigint generated always as identity primary key,
  petshop_id uuid not null references petshops on delete cascade,
  atendimento_id uuid not null references atendimentos on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  precisao real,
  em timestamptz not null default now()
);
create index rota_posicoes_atendimento_idx on rota_posicoes (atendimento_id, em desc);
create index rota_posicoes_petshop_idx on rota_posicoes (petshop_id, em desc);

alter table rota_posicoes enable row level security;
create policy rota_posicoes_membros on rota_posicoes for all to authenticated
  using (petshop_id in (select meus_petshops())) with check (petshop_id in (select meus_petshops()));

-- O carro só está "na rua" entre sair e chegar.
create function em_rota(p_atendimento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select etapa in ('saiu_para_buscar', 'saiu_para_entregar')
    from atendimento_etapas where atendimento_id = p_atendimento order by em desc limit 1
  ), false)
$$;

create function posicao_valida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not em_rota(new.atendimento_id) then
    raise exception 'O compartilhamento de localização não está ativo.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function posicao_valida() from public, anon, authenticated;

create trigger rota_posicoes_before_insert before insert on rota_posicoes
for each row execute function posicao_valida();

-- ---------------------------------------------------------------------------
-- Acerto de comissões
-- ---------------------------------------------------------------------------

create table comissao_acertos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  membro_id uuid not null references membros,
  de date not null,
  ate date not null,
  valor numeric(10,2) not null check (valor > 0),
  forma_pagamento forma_pagamento not null,
  lancamento_id uuid references lancamentos on delete set null,
  criado_por uuid references membros,
  criado_em timestamptz not null default now(),
  check (ate >= de)
);
create index comissao_acertos_membro_idx on comissao_acertos (membro_id, ate desc);
create index comissao_acertos_petshop_idx on comissao_acertos (petshop_id);
create index comissao_acertos_lancamento_idx on comissao_acertos (lancamento_id);
create index comissao_acertos_criado_por_idx on comissao_acertos (criado_por);

alter table comissao_acertos enable row level security;
create policy comissao_acertos_dono on comissao_acertos for select to authenticated using (tem_papel(petshop_id, '{dono}'));
create policy comissao_acertos_proprio on comissao_acertos for select to authenticated using (membro_id = membro_atual(petshop_id));

-- Paga as comissões "a_pagar" da pessoa até a data: marca como pagas, lança a despesa e registra o acerto.
create function registrar_acerto(p_membro uuid, p_ate date, p_forma forma_pagamento, p_id uuid default null, p_lancamento_id uuid default null)
returns comissao_acertos
language plpgsql security definer set search_path = public as $$
declare
  v_ps uuid;
  v_fuso text;
  v_nome text;
  v_valor numeric(10,2);
  v_de date;
  v_lanc uuid;
  v_acerto comissao_acertos;
begin
  select m.petshop_id, m.nome, p.fuso into v_ps, v_nome, v_fuso from membros m join petshops p on p.id = m.petshop_id where m.id = p_membro;
  if v_ps is null or not tem_papel(v_ps, '{dono}') then
    raise exception 'Só o dono paga comissões.' using errcode = '42501';
  end if;

  select coalesce(sum(c.valor), 0), min((a.inicio at time zone v_fuso)::date)
  into v_valor, v_de
  from comissoes c
  join atendimento_itens i on i.id = c.atendimento_item_id
  join atendimentos a on a.id = i.atendimento_id
  where c.membro_id = p_membro and c.status = 'a_pagar' and (a.inicio at time zone v_fuso)::date <= p_ate;

  if v_valor <= 0 then
    raise exception 'Não há comissão pendente até esta data.' using errcode = 'P0001';
  end if;

  insert into lancamentos (id, petshop_id, tipo, categoria, descricao, valor, forma_pagamento, status, competencia, pago_em)
  values (coalesce(p_lancamento_id, gen_random_uuid()), v_ps, 'despesa', 'Comissões', 'Comissão · ' || v_nome, v_valor, p_forma, 'pago', (now() at time zone v_fuso)::date, now())
  returning id into v_lanc;

  update comissoes c set status = 'pago'
  from atendimento_itens i join atendimentos a on a.id = i.atendimento_id
  where c.atendimento_item_id = i.id and c.membro_id = p_membro and c.status = 'a_pagar' and (a.inicio at time zone v_fuso)::date <= p_ate;

  insert into comissao_acertos (id, petshop_id, membro_id, de, ate, valor, forma_pagamento, lancamento_id, criado_por)
  values (coalesce(p_id, gen_random_uuid()), v_ps, p_membro, v_de, p_ate, v_valor, p_forma, v_lanc, membro_atual(v_ps))
  returning * into v_acerto;
  return v_acerto;
end $$;
revoke execute on function registrar_acerto(uuid, date, forma_pagamento, uuid, uuid) from public, anon;
grant execute on function registrar_acerto(uuid, date, forma_pagamento, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos (Supabase Storage)
-- ---------------------------------------------------------------------------
-- Bucket público: as fotos abrem no link do tutor sem login. Os caminhos são aleatórios
-- ({petshop}/pets/{pet}-{n}.jpg, {petshop}/etapas/{atendimento}/{uuid}.jpg), e ninguém de fora consegue
-- listar a pasta (não há leitura liberada pela API, só o endereço público de cada foto).

insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true) on conflict (id) do nothing;

create policy fotos_equipe_le on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1]::uuid in (select meus_petshops()));
create policy fotos_equipe_grava on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1]::uuid in (select meus_petshops()));
create policy fotos_equipe_troca on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1]::uuid in (select meus_petshops()));
create policy fotos_equipe_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1]::uuid in (select meus_petshops()));

-- ---------------------------------------------------------------------------
-- O que o tutor vê pelo link (sem login)
-- ---------------------------------------------------------------------------

create function acompanhamento(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_atd atendimentos%rowtype;
  v_ps petshops%rowtype;
  v_pet pets%rowtype;
  v_tutor tutores%rowtype;
  v_em_rota boolean;
begin
  select * into v_atd from atendimentos where token = p_token;
  if not found then return null; end if;
  select * into v_ps from petshops where id = v_atd.petshop_id;
  select * into v_pet from pets where id = v_atd.pet_id;
  select * into v_tutor from tutores where id = v_atd.tutor_id;
  v_em_rota := em_rota(v_atd.id);

  return jsonb_build_object(
    'petshop', jsonb_build_object('nome', v_ps.nome, 'whatsapp', v_ps.whatsapp, 'endereco', v_ps.endereco, 'fuso', v_ps.fuso),
    'pet', jsonb_build_object('nome', v_pet.nome, 'raca', v_pet.raca, 'especie', v_pet.especie, 'foto_path', v_pet.foto_path),
    'tutor', jsonb_build_object('nome', v_tutor.nome),
    'atendimento', jsonb_build_object(
      'id', v_atd.id, 'inicio', v_atd.inicio, 'fim', v_atd.fim, 'status', v_atd.status,
      'transporte', v_atd.transporte, 'endereco', v_atd.endereco_transporte,
      'motorista', (select nome from membros where id = v_atd.motorista_id),
      'itens', (select coalesce(jsonb_agg(nome order by nome), '[]') from atendimento_itens where atendimento_id = v_atd.id)
    ),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('para', para, 'em', em) order by em), '[]') from atendimento_eventos where atendimento_id = v_atd.id),
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'etapa', etapa, 'nota', nota, 'foto_path', foto_path, 'em', em) order by em), '[]')
               from atendimento_etapas where atendimento_id = v_atd.id),
    'em_rota', v_em_rota,
    'posicao', case when v_em_rota then (
      select jsonb_build_object('lat', lat, 'lng', lng, 'precisao', precisao, 'em', em)
      from rota_posicoes where atendimento_id = v_atd.id order by em desc limit 1
    ) end
  );
end $$;
grant execute on function acompanhamento(text) to anon, authenticated;
