-- APP PET · 0002 · Acesso da equipe por convite
-- O dono gera um código de 6 letras para um membro sem login;
-- a pessoa cria a conta, digita o código e passa a entrar no pet shop com o papel dela.

create table convites (
  codigo text primary key check (codigo ~ '^[A-Z2-9]{6}$'),
  petshop_id uuid not null references petshops on delete cascade,
  membro_id uuid not null unique references membros on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days'
);
create index convites_petshop on convites (petshop_id);

alter table convites enable row level security;
-- Só o dono enxerga os códigos. Criar e usar, só pelos RPCs.
create policy convites_dono on convites for select to authenticated using (tem_papel(petshop_id, '{dono}'));

-- Gera (ou renova) o convite de um membro que ainda não tem login. Devolve o código.
create function gerar_convite(p_membro uuid) returns convites
language plpgsql security definer set search_path = public as $$
declare
  v_ps uuid;
  v_tem_login boolean;
  v_bytes bytea;
  v_codigo text;
  v_conv convites;
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sem 0/O, 1/I/L
begin
  select petshop_id, user_id is not null into v_ps, v_tem_login from membros where id = p_membro and ativo;
  if v_ps is null or not tem_papel(v_ps, '{dono}') then
    raise exception 'Só o dono do pet shop pode convidar.' using errcode = '42501';
  end if;
  if v_tem_login then
    raise exception 'Esta pessoa já entra no app.' using errcode = 'P0001';
  end if;
  loop
    -- gen_random_uuid() usa gerador criptográfico; os 6 primeiros bytes de um UUID v4 são aleatórios.
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_codigo := '';
    for i in 0..5 loop
      v_codigo := v_codigo || substr(alfabeto, 1 + get_byte(v_bytes, i) % length(alfabeto), 1);
    end loop;
    begin
      insert into convites (codigo, petshop_id, membro_id) values (v_codigo, v_ps, p_membro)
      on conflict (membro_id) do update set codigo = excluded.codigo, criado_em = now(), expira_em = now() + interval '7 days'
      returning * into v_conv;
      return v_conv;
    exception when unique_violation then
      -- código repetido em outro convite: tenta de novo
    end;
  end loop;
end $$;

revoke execute on function gerar_convite(uuid) from public, anon;
grant execute on function gerar_convite(uuid) to authenticated;
