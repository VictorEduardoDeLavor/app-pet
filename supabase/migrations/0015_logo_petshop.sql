-- 0015 · Logo do pet shop
-- O dono sobe o logo em Dados do pet shop (bucket "fotos", pasta do pet shop).
-- Aparece no app, no link de acompanhamento do tutor e na página de agendamento online.
-- Só comandos aditivos: coluna nova e as duas funções públicas devolvendo também o logo.

alter table petshops add column if not exists logo_path text;

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
    'petshop', jsonb_build_object('nome', v_ps.nome, 'whatsapp', v_ps.whatsapp, 'endereco', v_ps.endereco, 'fuso', v_ps.fuso, 'logo_path', v_ps.logo_path),
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

create or replace function agenda_publica(p_slug text, p_de date default null, p_dias integer default 21) returns jsonb
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
      'sinal_pct', case when v_ps.pix_chave is not null then v_ps.sinal_pct else 0 end,
      'logo_path', v_ps.logo_path
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
