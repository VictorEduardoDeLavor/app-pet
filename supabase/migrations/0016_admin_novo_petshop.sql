-- 0016 · Novo pet shop pelo painel do administrador
-- O administrador cadastra o pet shop de um cliente (nome, WhatsApp, endereço e nome do dono) a partir
-- de um modelo: copia serviços, preços, pacotes e mensagens de outro pet shop, ou usa o padrão que o
-- app envia. O dono entra com o código de convite (14 dias) e aceita os termos no primeiro acesso.
-- Também dá para gerar um convite novo para o dono que ainda não entrou.
-- Só comandos aditivos: duas funções novas, executáveis só por quem está em plataforma_admins.

-- Código de 6 letras sem 0/O e 1/I/L, livre na tabela de convites (mesma regra de gerar_convite).
create or replace function codigo_convite_livre() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text;
begin
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_codigo := '';
    for i in 0..5 loop
      v_codigo := v_codigo || substr(alfabeto, 1 + get_byte(v_bytes, i) % length(alfabeto), 1);
    end loop;
    if not exists (select 1 from convites where codigo = v_codigo) then
      return v_codigo;
    end if;
  end loop;
end $$;

-- Convite do dono: usa o código pedido (se válido e livre) ou sorteia um.
create or replace function admin_convite_dono(p_petshop uuid, p_codigo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_membro uuid;
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_expira timestamptz := now() + interval '14 days';
begin
  if not sou_admin() then
    raise exception 'Só o administrador' using errcode = '42501';
  end if;
  select id into v_membro from membros
  where petshop_id = p_petshop and papel = 'dono' and ativo and user_id is null
  order by criado_em limit 1;
  if v_membro is null then
    raise exception 'O dono deste pet shop já entra no app.' using errcode = 'P0001';
  end if;
  if v_codigo = '' then
    v_codigo := codigo_convite_livre();
  elsif v_codigo !~ '^[A-Z2-9]{6}$' then
    raise exception 'O código precisa ter 6 letras ou números (sem 0, O, 1, I e L).' using errcode = 'P0001';
  elsif exists (select 1 from convites where codigo = v_codigo and membro_id <> v_membro) then
    raise exception 'Esse código já foi usado. Escolha outro.' using errcode = 'P0001';
  end if;
  insert into convites (codigo, petshop_id, membro_id, expira_em) values (v_codigo, p_petshop, v_membro, v_expira)
  on conflict (membro_id) do update
    set codigo = excluded.codigo, criado_em = now(), expira_em = excluded.expira_em, usado_em = null, usado_por = null;
  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_expira);
end $$;

-- p: { nome, whatsapp?, endereco?, dono_nome?, codigo?, modelo? (id de outro pet shop),
--      servicos?: [{id, nome, categoria, comissao_pct, precos: {P: {preco, duracao}, ...}}],
--      planos?: [{nome, servicos: [ids de servicos acima], quantidade_usos, validade_dias, preco}],
--      mensagens?: [{gatilho, titulo, texto}] }
create or replace function admin_criar_petshop(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nome text := trim(coalesce(p->>'nome', ''));
  v_modelo uuid := nullif(p->>'modelo', '')::uuid;
  v_base text;
  v_slug text;
  v_n integer := 1;
  v_ps uuid;
  v_novo uuid;
  v_mapa jsonb := '{}'::jsonb;
  r record;
  s jsonb;
  pr record;
  pl jsonb;
  v_convite jsonb;
begin
  if not sou_admin() then
    raise exception 'Só o administrador' using errcode = '42501';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Informe o nome do pet shop.' using errcode = 'P0001';
  end if;
  if v_modelo is not null and not exists (select 1 from petshops where id = v_modelo) then
    raise exception 'Pet shop modelo não encontrado.' using errcode = 'P0001';
  end if;

  -- Endereço da página de agendamento: o nome sem acento; se já existir, ganha -2, -3...
  v_base := left(trim(both '-' from regexp_replace(
    translate(lower(v_nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '-', 'g')), 40);
  if length(v_base) < 3 then v_base := 'petshop-' || v_base; end if;
  v_base := trim(both '-' from v_base);
  v_slug := v_base;
  while exists (select 1 from petshops where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into petshops (nome, slug, whatsapp, endereco)
  values (v_nome, v_slug, nullif(regexp_replace(coalesce(p->>'whatsapp', ''), '\D', '', 'g'), ''), nullif(trim(coalesce(p->>'endereco', '')), ''))
  returning id into v_ps;

  insert into membros (petshop_id, nome, papel)
  values (v_ps, coalesce(nullif(trim(coalesce(p->>'dono_nome', '')), ''), 'Dono'), 'dono');

  if v_modelo is not null then
    -- Copia do pet shop modelo (só o que está ativo).
    for r in select * from servicos where petshop_id = v_modelo and ativo loop
      insert into servicos (petshop_id, nome, categoria, descricao, comissao_pct)
      values (v_ps, r.nome, r.categoria, r.descricao, r.comissao_pct) returning id into v_novo;
      v_mapa := v_mapa || jsonb_build_object(r.id::text, v_novo);
      insert into servico_precos (petshop_id, servico_id, porte, preco, duracao_min)
      select v_ps, v_novo, sp.porte, sp.preco, sp.duracao_min from servico_precos sp where sp.servico_id = r.id;
    end loop;
    insert into planos_modelo (petshop_id, nome, servico_ids, quantidade_usos, validade_dias, preco)
    select v_ps, pm.nome,
      array(select (v_mapa->>x::text)::uuid from unnest(pm.servico_ids) x where v_mapa ? x::text),
      pm.quantidade_usos, pm.validade_dias, pm.preco
    from planos_modelo pm where pm.petshop_id = v_modelo and pm.ativo;
    insert into mensagem_modelos (petshop_id, gatilho, titulo, texto, ativo, antecedencia_horas)
    select v_ps, mm.gatilho, mm.titulo, mm.texto, mm.ativo, mm.antecedencia_horas from mensagem_modelos mm where mm.petshop_id = v_modelo;
  else
    -- Padrão enviado pelo app (o mesmo de quem se cadastra sozinho).
    for s in select * from jsonb_array_elements(coalesce(p->'servicos', '[]'::jsonb)) loop
      insert into servicos (petshop_id, nome, categoria, comissao_pct)
      values (v_ps, s->>'nome', (s->>'categoria')::categoria_servico, coalesce((s->>'comissao_pct')::numeric, 0))
      returning id into v_novo;
      v_mapa := v_mapa || jsonb_build_object(s->>'id', v_novo);
      for pr in select key, value from jsonb_each(coalesce(s->'precos', '{}'::jsonb)) loop
        insert into servico_precos (petshop_id, servico_id, porte, preco, duracao_min)
        values (v_ps, v_novo, pr.key::porte, (pr.value->>'preco')::numeric, (pr.value->>'duracao')::smallint);
      end loop;
    end loop;
    for pl in select * from jsonb_array_elements(coalesce(p->'planos', '[]'::jsonb)) loop
      insert into planos_modelo (petshop_id, nome, servico_ids, quantidade_usos, validade_dias, preco)
      values (v_ps, pl->>'nome',
        array(select (v_mapa->>x)::uuid from jsonb_array_elements_text(coalesce(pl->'servicos', '[]'::jsonb)) x where v_mapa ? x),
        (pl->>'quantidade_usos')::smallint, (pl->>'validade_dias')::smallint, (pl->>'preco')::numeric);
    end loop;
    insert into mensagem_modelos (petshop_id, gatilho, titulo, texto, ativo)
    select v_ps, (m->>'gatilho')::gatilho_mensagem, m->>'titulo', m->>'texto', true
    from jsonb_array_elements(coalesce(p->'mensagens', '[]'::jsonb)) m;
  end if;

  v_convite := admin_convite_dono(v_ps, p->>'codigo');
  return jsonb_build_object('petshop_id', v_ps, 'slug', v_slug) || v_convite;
end $$;

revoke execute on function codigo_convite_livre(), admin_convite_dono(uuid, text), admin_criar_petshop(jsonb) from public, anon;
-- O sorteio do código só roda por dentro das funções acima.
revoke execute on function codigo_convite_livre() from authenticated;
grant execute on function admin_convite_dono(uuid, text), admin_criar_petshop(jsonb) to authenticated;
