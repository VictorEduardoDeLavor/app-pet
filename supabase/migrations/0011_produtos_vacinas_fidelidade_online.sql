-- APP PET · 0011 · Produtos e estoque, vacinas, fidelidade, agendamento online com sinal por Pix
-- e correções (plano vencido trava venda nova, "sem comissão" por pessoa).
-- Só comandos aditivos: nada é removido.

alter type gatilho_mensagem add value if not exists 'vacina';

-- ---------------------------------------------------------------------------
-- Configurações novas do pet shop e do atendimento
-- ---------------------------------------------------------------------------

alter table petshops
  add column agendamento_online boolean not null default false,
  add column pix_chave text,
  add column pix_cidade text,
  add column sinal_pct smallint not null default 0 check (sinal_pct between 0 and 100),
  add column fidelidade_ativa boolean not null default false,
  add column fidelidade_meta smallint not null default 10 check (fidelidade_meta between 2 and 50),
  add column fidelidade_servico_ids uuid[] not null default '{}',
  add column fidelidade_premio text not null default '1 banho grátis';

alter table petshops add constraint petshops_slug_formato check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$');

-- Pessoa que não recebe comissão (ex.: o dono que também atende). 0% continua valendo "usar a % do serviço".
alter table membros add column sem_comissao boolean not null default false;

-- Sinal pedido no agendamento online (pago por Pix e conferido pela equipe).
alter table atendimentos
  add column sinal_valor numeric(10,2) not null default 0 check (sinal_valor >= 0),
  add column sinal_pago boolean not null default false;

-- ---------------------------------------------------------------------------
-- Produtos, vendas e estoque
-- ---------------------------------------------------------------------------

create table produtos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null default 'Outros',
  preco_venda numeric(10,2) not null default 0 check (preco_venda >= 0),
  custo numeric(10,2) check (custo >= 0),
  estoque numeric(10,2) not null default 0,
  estoque_minimo numeric(10,2) not null default 0 check (estoque_minimo >= 0),
  unidade text not null default 'un',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index produtos_petshop_idx on produtos (petshop_id, nome);

create table vendas (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  tutor_id uuid references tutores on delete set null,
  atendimento_id uuid references atendimentos on delete set null,
  total numeric(10,2) not null check (total >= 0),
  desconto numeric(10,2) not null default 0 check (desconto >= 0),
  status text not null default 'pago' check (status in ('pago', 'pendente', 'cancelada')),
  forma_pagamento forma_pagamento,
  membro_id uuid references membros on delete set null,
  lancamento_id uuid references lancamentos on delete set null,
  criado_em timestamptz not null default now()
);
create index vendas_petshop_idx on vendas (petshop_id, criado_em desc);
create index vendas_tutor_idx on vendas (tutor_id);
create index vendas_atendimento_idx on vendas (atendimento_id);
create index vendas_lancamento_idx on vendas (lancamento_id);
create index vendas_membro_idx on vendas (membro_id);

create table venda_itens (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  venda_id uuid not null references vendas on delete cascade,
  produto_id uuid references produtos on delete set null,
  nome text not null,
  quantidade numeric(10,2) not null check (quantidade > 0),
  preco numeric(10,2) not null check (preco >= 0)
);
create index venda_itens_venda_idx on venda_itens (venda_id);
create index venda_itens_produto_idx on venda_itens (produto_id);
create index venda_itens_petshop_idx on venda_itens (petshop_id);

create table estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  produto_id uuid not null references produtos on delete cascade,
  tipo text not null check (tipo in ('entrada', 'venda', 'ajuste', 'estorno')),
  quantidade numeric(10,2) not null check (quantidade <> 0),
  custo_unitario numeric(10,2) check (custo_unitario >= 0),
  venda_id uuid references vendas on delete set null,
  observacao text,
  membro_id uuid references membros on delete set null,
  em timestamptz not null default now()
);
create index estoque_movimentos_produto_idx on estoque_movimentos (produto_id, em desc);
create index estoque_movimentos_petshop_idx on estoque_movimentos (petshop_id);
create index estoque_movimentos_venda_idx on estoque_movimentos (venda_id);
create index estoque_movimentos_membro_idx on estoque_movimentos (membro_id);

-- O saldo do estoque é a soma dos movimentos (o app nunca digita o saldo direto).
create function estoque_aplicar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update produtos set estoque = estoque + new.quantidade where id = new.produto_id;
  if new.tipo = 'entrada' and new.custo_unitario is not null then
    update produtos set custo = new.custo_unitario where id = new.produto_id;
  end if;
  return new;
end $$;

create trigger estoque_movimentos_after_insert after insert on estoque_movimentos
for each row execute function estoque_aplicar();

-- Venda atômica: receita no caixa (paga ou a receber) + venda + itens + baixa no estoque.
create function registrar_venda(p_venda jsonb, p_itens jsonb, p_lancamento jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_ps uuid := (p_venda->>'petshop_id')::uuid;
  v_id uuid := coalesce((p_venda->>'id')::uuid, gen_random_uuid());
  v_lanc uuid;
begin
  if p_lancamento is not null then
    insert into lancamentos select * from jsonb_populate_record(null::lancamentos,
      p_lancamento || jsonb_build_object('id', coalesce(p_lancamento->>'id', gen_random_uuid()::text), 'criado_em', now()))
    returning id into v_lanc;
  end if;
  insert into vendas (id, petshop_id, tutor_id, atendimento_id, total, desconto, status, forma_pagamento, membro_id, lancamento_id)
  select v_id, v_ps, v.tutor_id, v.atendimento_id, v.total, coalesce(v.desconto, 0), coalesce(v.status, 'pago'), v.forma_pagamento,
         membro_atual(v_ps), v_lanc
  from jsonb_populate_record(null::vendas, p_venda) v;
  insert into venda_itens (petshop_id, venda_id, produto_id, nome, quantidade, preco)
  select v_ps, v_id, i.produto_id, i.nome, i.quantidade, i.preco from jsonb_populate_recordset(null::venda_itens, p_itens) i;
  insert into estoque_movimentos (petshop_id, produto_id, tipo, quantidade, venda_id, membro_id)
  select v_ps, i.produto_id, 'venda', -i.quantidade, v_id, membro_atual(v_ps)
  from jsonb_populate_recordset(null::venda_itens, p_itens) i where i.produto_id is not null;
  return v_id;
end $$;

-- Entrada de mercadoria: movimento + (opcional) despesa da compra, juntos.
create function registrar_entrada_estoque(p_mov jsonb, p_despesa jsonb default null) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if p_despesa is not null then
    insert into lancamentos select * from jsonb_populate_record(null::lancamentos,
      p_despesa || jsonb_build_object('id', coalesce(p_despesa->>'id', gen_random_uuid()::text), 'criado_em', now()));
  end if;
  insert into estoque_movimentos (id, petshop_id, produto_id, tipo, quantidade, custo_unitario, observacao, membro_id)
  select coalesce(m.id, gen_random_uuid()), m.petshop_id, m.produto_id, coalesce(m.tipo, 'entrada'), m.quantidade, m.custo_unitario, m.observacao,
         membro_atual(m.petshop_id)
  from jsonb_populate_record(null::estoque_movimentos, p_mov) m
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Carteira de saúde (vacinas, vermífugo, antipulgas)
-- ---------------------------------------------------------------------------

create table pet_vacinas (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  pet_id uuid not null references pets on delete cascade,
  tipo text not null default 'vacina' check (tipo in ('vacina', 'vermifugo', 'antipulgas', 'outro')),
  nome text not null check (length(trim(nome)) > 0),
  aplicada_em date,
  proxima_em date,
  observacao text,
  criado_em timestamptz not null default now()
);
create index pet_vacinas_pet_idx on pet_vacinas (pet_id);
create index pet_vacinas_proxima_idx on pet_vacinas (petshop_id, proxima_em);

-- ---------------------------------------------------------------------------
-- Fidelidade (cartão de selos)
-- ---------------------------------------------------------------------------

create table fidelidade_resgates (
  id uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops on delete cascade,
  pet_id uuid not null references pets on delete cascade,
  atendimento_id uuid references atendimentos on delete set null,
  valor numeric(10,2) not null default 0 check (valor >= 0),
  em timestamptz not null default now()
);
create index fidelidade_resgates_pet_idx on fidelidade_resgates (pet_id, em desc);
create index fidelidade_resgates_atendimento_idx on fidelidade_resgates (atendimento_id);
create index fidelidade_resgates_petshop_idx on fidelidade_resgates (petshop_id);

-- Selos do pet: atendimentos finalizados desde o último resgate, com pelo menos um serviço que conta
-- (os escolhidos pelo pet shop ou, se nenhum, banho e tosa) e que não saiu de graça pelo plano.
create function fidelidade_selos(p_pet uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from atendimentos a
  join petshops p on p.id = a.petshop_id
  where a.pet_id = p_pet and a.status = 'finalizado'
    and not exists (select 1 from fidelidade_resgates r where r.atendimento_id = a.id)
    and (a.inicio at time zone p.fuso)::date >= coalesce(
      (select max((r.em at time zone p.fuso)::date) from fidelidade_resgates r where r.pet_id = p_pet), '-infinity'::date)
    and exists (
      select 1 from atendimento_itens i join servicos s on s.id = i.servico_id
      where i.atendimento_id = a.id and not i.coberto_por_plano
        and case when cardinality(p.fidelidade_servico_ids) > 0 then i.servico_id = any (p.fidelidade_servico_ids)
                 else s.categoria in ('banho', 'tosa') end
    )
$$;

-- ---------------------------------------------------------------------------
-- RLS das tabelas novas
-- ---------------------------------------------------------------------------

alter table produtos enable row level security;
alter table vendas enable row level security;
alter table venda_itens enable row level security;
alter table estoque_movimentos enable row level security;
alter table pet_vacinas enable row level security;
alter table fidelidade_resgates enable row level security;

create policy produtos_ler on produtos for select to authenticated using (petshop_id in (select meus_petshops()));
create policy produtos_gestao on produtos for all to authenticated
  using (tem_papel(petshop_id, '{dono,recepcao}')) with check (tem_papel(petshop_id, '{dono,recepcao}'));
create policy vendas_gestao on vendas for all to authenticated
  using (tem_papel(petshop_id, '{dono,recepcao}')) with check (tem_papel(petshop_id, '{dono,recepcao}'));
create policy venda_itens_gestao on venda_itens for all to authenticated
  using (tem_papel(petshop_id, '{dono,recepcao}')) with check (tem_papel(petshop_id, '{dono,recepcao}'));
create policy estoque_movimentos_gestao on estoque_movimentos for all to authenticated
  using (tem_papel(petshop_id, '{dono,recepcao}')) with check (tem_papel(petshop_id, '{dono,recepcao}'));
create policy pet_vacinas_membros on pet_vacinas for all to authenticated
  using (petshop_id in (select meus_petshops())) with check (petshop_id in (select meus_petshops()));
create policy fidelidade_resgates_membros on fidelidade_resgates for all to authenticated
  using (petshop_id in (select meus_petshops())) with check (petshop_id in (select meus_petshops()));

-- ---------------------------------------------------------------------------
-- Correção: plano vencido (ou zerado) não pode travar a venda de um plano novo
-- ---------------------------------------------------------------------------

create function plano_libera_anteriores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update planos_pet set status = case when saldo_plano(id) <= 0 then 'finalizado'::status_plano else 'vencido'::status_plano end
  where pet_id = new.pet_id and id <> new.id and status = 'ativo'
    and (vencimento < current_date or saldo_plano(id) <= 0);
  return new;
end $$;

create trigger planos_pet_before_insert before insert on planos_pet
for each row execute function plano_libera_anteriores();

-- ---------------------------------------------------------------------------
-- Finalizar: desconta o sinal já pago e respeita quem não recebe comissão
-- ---------------------------------------------------------------------------

create or replace function atendimento_mudou_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ps petshops%rowtype;
  v_cobre boolean;
  v_pet text;
  v_servicos text;
  v_receber numeric(10,2);
begin
  if not transicao_valida(old.status, new.status) then
    raise exception 'Não é possível passar de % para %', old.status, new.status using errcode = 'P0001';
  end if;

  select * into v_ps from petshops where id = new.petshop_id;
  select exists (select 1 from atendimento_itens where atendimento_id = new.id and coberto_por_plano) into v_cobre;

  if new.plano_pet_id is not null and v_cobre
     and (new.status = 'finalizado' or (new.status = 'faltou' and v_ps.falta_consome_uso)) then
    if saldo_plano(new.plano_pet_id) > 0 then
      insert into plano_usos (petshop_id, plano_pet_id, atendimento_id) values (new.petshop_id, new.plano_pet_id, new.id);
    else
      update atendimento_itens set coberto_por_plano = false where atendimento_id = new.id;
      new.valor_total := greatest(0, (select coalesce(sum(preco), 0) from atendimento_itens where atendimento_id = new.id) - new.desconto);
      new.plano_pet_id := null;
    end if;
  end if;

  if new.status = 'finalizado' then
    -- O sinal pago no agendamento online já entrou no caixa: fica a receber só a diferença.
    v_receber := greatest(0, new.valor_total - case when new.sinal_pago then new.sinal_valor else 0 end);
    if v_receber > 0 then
      select nome into v_pet from pets where id = new.pet_id;
      select string_agg(nome, ' + ' order by nome) into v_servicos from atendimento_itens where atendimento_id = new.id;
      insert into lancamentos (petshop_id, tipo, categoria, descricao, valor, status, competencia, atendimento_id)
      values (new.petshop_id, 'receita', 'Serviços', v_pet || ' · ' || v_servicos, v_receber, 'pendente',
              (new.inicio at time zone v_ps.fuso)::date, new.id);
    else
      new.pago := true;
    end if;

    -- Comissão por item, sobre o preço de tabela: % da pessoa quando definida, senão a do serviço.
    insert into comissoes (petshop_id, membro_id, atendimento_item_id, valor)
    select new.petshop_id, new.profissional_id, i.id, round(i.preco * x.pct / 100, 2)
    from atendimento_itens i
    join servicos s on s.id = i.servico_id
    join membros m on m.id = new.profissional_id
    cross join lateral (select coalesce(nullif(m.comissao_pct, 0), s.comissao_pct) as pct) x
    where i.atendimento_id = new.id and x.pct > 0 and not m.sem_comissao;

    update pets set ultima_visita = (new.inicio at time zone v_ps.fuso)::date where id = new.pet_id;
  end if;

  insert into atendimento_eventos (petshop_id, atendimento_id, de, para, membro_id)
  values (new.petshop_id, new.id, old.status, new.status, membro_atual(new.petshop_id));
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Link do tutor: agora mostra também o cartão de fidelidade
-- ---------------------------------------------------------------------------

create or replace function acompanhamento(p_token text) returns jsonb
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
      'itens', (select coalesce(jsonb_agg(nome order by nome), '[]') from atendimento_itens where atendimento_id = v_atd.id),
      'origem', v_atd.origem, 'sinal', v_atd.sinal_valor, 'sinal_pago', v_atd.sinal_pago
    ),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('para', para, 'em', em) order by em), '[]') from atendimento_eventos where atendimento_id = v_atd.id),
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'etapa', etapa, 'nota', nota, 'foto_path', foto_path, 'em', em) order by em), '[]')
               from atendimento_etapas where atendimento_id = v_atd.id),
    'em_rota', v_em_rota,
    'posicao', case when v_em_rota then (
      select jsonb_build_object('lat', lat, 'lng', lng, 'precisao', precisao, 'em', em)
      from rota_posicoes where atendimento_id = v_atd.id order by em desc limit 1
    ) end,
    'fidelidade', case when v_ps.fidelidade_ativa then jsonb_build_object(
      'meta', v_ps.fidelidade_meta, 'selos', fidelidade_selos(v_pet.id), 'premio', v_ps.fidelidade_premio
    ) end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Agendamento online (página pública do pet shop, sem login)
-- ---------------------------------------------------------------------------

-- Serviços, preços por porte, funcionamento e horários ocupados (sem nomes) dos próximos dias.
create function agenda_publica(p_slug text, p_de date default null, p_dias integer default 21) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ps petshops%rowtype;
  v_de date;
begin
  select * into v_ps from petshops where slug = lower(p_slug);
  if not found or not v_ps.agendamento_online or not assinatura_liberada(v_ps.id) then
    return null;
  end if;
  v_de := greatest(coalesce(p_de, (now() at time zone v_ps.fuso)::date), (now() at time zone v_ps.fuso)::date);
  return jsonb_build_object(
    'petshop', jsonb_build_object(
      'nome', v_ps.nome, 'whatsapp', v_ps.whatsapp, 'endereco', v_ps.endereco, 'fuso', v_ps.fuso,
      'dias_abertos', v_ps.dias_abertos, 'abre', to_char(v_ps.abre, 'HH24:MI'), 'fecha', to_char(v_ps.fecha, 'HH24:MI'),
      'sinal_pct', case when v_ps.pix_chave is not null then v_ps.sinal_pct else 0 end
    ),
    'servicos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'nome', s.nome, 'categoria', s.categoria, 'descricao', s.descricao,
        'precos', (select jsonb_object_agg(sp.porte, jsonb_build_object('preco', sp.preco, 'duracao', sp.duracao_min))
                   from servico_precos sp where sp.servico_id = s.id)
      ) order by s.categoria, s.nome), '[]'::jsonb)
      from servicos s where s.petshop_id = v_ps.id and s.ativo
    ),
    'equipe', (
      select coalesce(jsonb_agg(m.id), '[]'::jsonb) from membros m
      where m.petshop_id = v_ps.id and m.ativo and m.papel in ('banhista', 'dono')
    ),
    'ocupados', (
      select coalesce(jsonb_agg(jsonb_build_object('p', a.profissional_id, 'i', a.inicio, 'f', a.fim)), '[]'::jsonb)
      from atendimentos a
      where a.petshop_id = v_ps.id and a.status not in ('cancelado', 'faltou')
        and a.fim > (v_de::timestamp at time zone v_ps.fuso)
        and a.inicio < ((v_de + least(greatest(p_dias, 1), 60))::timestamp at time zone v_ps.fuso)
    )
  );
end $$;

-- Cria o pedido: acha ou cadastra o tutor (pelo WhatsApp) e o pet (pelo nome), escolhe quem atende
-- e grava o atendimento com origem "portal". Devolve o link de acompanhamento e o sinal a pagar.
create function agendar_online(p_slug text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ps petshops%rowtype;
  v_zap text;
  v_nome text := initcap(trim(coalesce(p->>'nome', '')));
  v_nome_pet text := initcap(trim(coalesce(p->>'pet', '')));
  v_porte porte;
  v_data date;
  v_hora time;
  v_hoje date;
  v_inicio timestamptz;
  v_servicos uuid[];
  v_dur integer;
  v_total numeric(10,2);
  v_n integer;
  v_prof uuid;
  v_tutor uuid;
  v_pet uuid;
  v_atd uuid;
  v_token text;
  v_sinal numeric(10,2) := 0;
begin
  select * into v_ps from petshops where slug = lower(p_slug);
  if not found or not v_ps.agendamento_online or not assinatura_liberada(v_ps.id) then
    raise exception 'O agendamento online deste pet shop está desligado.' using errcode = 'P0001';
  end if;
  if length(v_nome) < 2 then raise exception 'Informe seu nome.' using errcode = 'P0001'; end if;
  if length(v_nome_pet) < 1 then raise exception 'Informe o nome do pet.' using errcode = 'P0001'; end if;
  if coalesce((p->>'aceite')::boolean, false) is not true then
    raise exception 'Para agendar, autorize o contato pelo WhatsApp.' using errcode = 'P0001';
  end if;

  v_zap := regexp_replace(coalesce(p->>'whatsapp', ''), '\D', '', 'g');
  if length(v_zap) in (10, 11) then v_zap := '55' || v_zap; end if;
  if v_zap !~ '^55[0-9]{10,11}$' then raise exception 'Informe um WhatsApp com DDD.' using errcode = 'P0001'; end if;

  begin
    v_porte := (p->>'porte')::porte;
    v_data := (p->>'data')::date;
    v_hora := (p->>'hora')::time;
    select array_agg(x::uuid) into v_servicos from jsonb_array_elements_text(p->'servicos') x;
  exception when others then
    raise exception 'Dados do agendamento incompletos.' using errcode = 'P0001';
  end;
  if v_porte is null or v_data is null or v_hora is null then
    raise exception 'Dados do agendamento incompletos.' using errcode = 'P0001';
  end if;
  if v_servicos is null or cardinality(v_servicos) = 0 then raise exception 'Escolha pelo menos um serviço.' using errcode = 'P0001'; end if;

  v_hoje := (now() at time zone v_ps.fuso)::date;
  if v_data < v_hoje or v_data > v_hoje + 60 then raise exception 'Escolha um dia dos próximos 60 dias.' using errcode = 'P0001'; end if;
  if not (extract(dow from v_data)::smallint = any (v_ps.dias_abertos)) then
    raise exception 'O pet shop não abre neste dia.' using errcode = 'P0001';
  end if;
  v_inicio := (v_data + v_hora) at time zone v_ps.fuso;
  if v_inicio < now() + interval '30 minutes' then
    raise exception 'Escolha um horário com pelo menos 30 minutos de antecedência.' using errcode = 'P0001';
  end if;

  select coalesce(sum(sp.duracao_min), 0), coalesce(sum(sp.preco), 0), count(*)
  into v_dur, v_total, v_n
  from servicos s join servico_precos sp on sp.servico_id = s.id and sp.porte = v_porte
  where s.id = any (v_servicos) and s.petshop_id = v_ps.id and s.ativo;
  if v_n <> cardinality(v_servicos) then raise exception 'Algum serviço escolhido não está disponível.' using errcode = 'P0001'; end if;
  if v_hora < v_ps.abre or v_hora + make_interval(mins => v_dur) > v_ps.fecha then
    raise exception 'Esse horário passa do fechamento. Escolha um mais cedo.' using errcode = 'P0001';
  end if;

  -- Freio contra abuso: no máximo 3 pedidos online em aberto por WhatsApp.
  if (select count(*) from atendimentos a join tutores t on t.id = a.tutor_id
      where a.petshop_id = v_ps.id and t.whatsapp = v_zap and a.origem = 'portal'
        and a.status in ('agendado', 'confirmado') and a.inicio > now()) >= 3 then
    raise exception 'Você já tem 3 agendamentos em aberto. Fale com o pet shop pelo WhatsApp.' using errcode = 'P0001';
  end if;

  -- Quem atende: o primeiro banhista livre (o dono só se nenhum banhista estiver livre).
  select m.id into v_prof from membros m
  where m.petshop_id = v_ps.id and m.ativo and m.papel in ('banhista', 'dono')
    and not exists (
      select 1 from atendimentos a
      where a.profissional_id = m.id and a.status not in ('cancelado', 'faltou')
        and tstzrange(a.inicio, a.fim) && tstzrange(v_inicio, v_inicio + make_interval(mins => v_dur))
    )
  order by (m.papel = 'dono'), m.criado_em
  limit 1;
  if v_prof is null then raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001'; end if;

  select id into v_tutor from tutores where petshop_id = v_ps.id and whatsapp = v_zap;
  if v_tutor is null then
    insert into tutores (petshop_id, nome, whatsapp, origem, consentimento_whatsapp_em)
    values (v_ps.id, v_nome, v_zap, 'agendamento online', now()) returning id into v_tutor;
  else
    update tutores set consentimento_whatsapp_em = coalesce(consentimento_whatsapp_em, now()) where id = v_tutor;
  end if;

  select id into v_pet from pets where tutor_id = v_tutor and lower(nome) = lower(v_nome_pet) limit 1;
  if v_pet is null then
    insert into pets (petshop_id, tutor_id, nome, especie, raca, porte)
    values (v_ps.id, v_tutor, v_nome_pet, coalesce(nullif(p->>'especie', '')::especie, 'cao'), nullif(trim(coalesce(p->>'raca', '')), ''), v_porte)
    returning id into v_pet;
  end if;

  if v_ps.pix_chave is not null and v_ps.sinal_pct > 0 then
    v_sinal := round(v_total * v_ps.sinal_pct / 100.0, 2);
  end if;

  insert into atendimentos (petshop_id, pet_id, tutor_id, profissional_id, inicio, fim, origem, valor_total, observacoes, sinal_valor)
  values (v_ps.id, v_pet, v_tutor, v_prof, v_inicio, v_inicio + make_interval(mins => v_dur), 'portal', v_total,
          nullif(trim(coalesce(p->>'observacoes', '')), ''), v_sinal)
  returning id, token into v_atd, v_token;

  insert into atendimento_itens (petshop_id, atendimento_id, servico_id, nome, preco, duracao_min)
  select v_ps.id, v_atd, s.id, s.nome, sp.preco, sp.duracao_min
  from servicos s join servico_precos sp on sp.servico_id = s.id and sp.porte = v_porte
  where s.id = any (v_servicos);

  return jsonb_build_object(
    'token', v_token, 'data', v_data, 'hora', to_char(v_hora, 'HH24:MI'), 'total', v_total, 'sinal', v_sinal,
    'pix_chave', case when v_sinal > 0 then v_ps.pix_chave end, 'pix_cidade', v_ps.pix_cidade,
    'petshop', v_ps.nome, 'whatsapp', v_ps.whatsapp
  );
end $$;

-- ---------------------------------------------------------------------------
-- Recebimentos: venda a receber fica paga junto com a receita; estorno reabre o atendimento
-- ---------------------------------------------------------------------------

create or replace function lancamento_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.atendimento_id is not null and new.categoria <> 'Sinal' then
    update atendimentos set pago = true where id = new.atendimento_id;
  end if;
  update vendas set status = 'pago', forma_pagamento = new.forma_pagamento where lancamento_id = new.id and status = 'pendente';
  return new;
end $$;

create function lancamento_estornado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.atendimento_id is not null then
    update atendimentos set pago = false where id = new.atendimento_id;
  end if;
  update vendas set status = 'pendente', forma_pagamento = null where lancamento_id = new.id and status = 'pago';
  return new;
end $$;

create trigger lancamentos_after_estorno after update of status on lancamentos
for each row when (old.status = 'pago' and new.status = 'pendente')
execute function lancamento_estornado();

-- ---------------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------------

revoke execute on function estoque_aplicar(), plano_libera_anteriores(), lancamento_estornado() from public, anon, authenticated;
revoke execute on function fidelidade_selos(uuid), registrar_venda(jsonb, jsonb, jsonb), registrar_entrada_estoque(jsonb, jsonb)
  from public, anon;
grant execute on function fidelidade_selos(uuid), registrar_venda(jsonb, jsonb, jsonb), registrar_entrada_estoque(jsonb, jsonb)
  to authenticated;
grant execute on function agenda_publica(text, date, integer), agendar_online(text, jsonb) to anon, authenticated;
