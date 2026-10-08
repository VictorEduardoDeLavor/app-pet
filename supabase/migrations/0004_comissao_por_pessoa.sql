-- APP PET · 0004 · Comissão: % da pessoa (quando definida) vale sobre a % do serviço
-- Sobre o preço de tabela de cada item; itens cobertos por plano contam (o trabalho foi feito).

create or replace function atendimento_mudou_status() returns trigger
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

    -- Comissão por item, sobre o preço de tabela (itens de plano contam: o trabalho foi feito).
    -- % da pessoa, quando definida; senão a % do serviço.
    insert into comissoes (petshop_id, membro_id, atendimento_item_id, valor)
    select new.petshop_id, new.profissional_id, i.id, round(i.preco * x.pct / 100, 2)
    from atendimento_itens i
    join servicos s on s.id = i.servico_id
    join membros m on m.id = new.profissional_id
    cross join lateral (select coalesce(nullif(m.comissao_pct, 0), s.comissao_pct) as pct) x
    where i.atendimento_id = new.id and x.pct > 0;

    update pets set ultima_visita = (new.inicio at time zone v_ps.fuso)::date where id = new.pet_id;
  end if;

  insert into atendimento_eventos (petshop_id, atendimento_id, de, para, membro_id)
  values (new.petshop_id, new.id, old.status, new.status, membro_atual(new.petshop_id));
  return new;
end $$;
