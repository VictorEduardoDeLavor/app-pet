-- APP PET · 0014 · Ligação com o Asaas pelo painel do administrador
-- O botão "Conectar o Asaas" cria o webhook na conta do Asaas com um token novo e guarda aqui só a
-- impressão SHA-256 dele (nunca o token). Também guarda de quem é a conta e o último aviso recebido.
-- Eventos de cobranças que não são de pet shops (outros negócios na mesma conta Asaas) não são guardados.
-- Só comandos aditivos.

create table plataforma_config (
  chave text primary key,
  valor text,
  atualizado_em timestamptz not null default now()
);
alter table plataforma_config enable row level security;
-- Sem policies: só as Edge Functions (chave de serviço) leem e gravam.

create or replace function asaas_processar_evento(p_evento jsonb) returns text
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

  -- Cobrança de outro negócio na mesma conta do Asaas: responde ok e não guarda nada.
  if v_ps is null then
    return 'ignorado';
  end if;
  insert into asaas_eventos (id, evento, payload, petshop_id) values (p_evento->>'id', v_evento, p_evento, v_ps);

  if v_pay is not null then
    if v_evento = 'PAYMENT_DELETED' then
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

revoke execute on function asaas_processar_evento(jsonb) from public, anon, authenticated;
