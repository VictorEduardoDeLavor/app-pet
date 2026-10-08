-- APP PET · 0003 · Usar o convite
-- Liga o login atual ao membro convidado e marca o código como usado (fica o registro de quem usou e quando).

alter table convites
  add column usado_em timestamptz,
  add column usado_por uuid references auth.users on delete set null;

create function aceitar_convite(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v convites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para usar o convite.' using errcode = '42501';
  end if;
  select * into v from convites
  where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')) and usado_em is null;
  if not found or v.expira_em < now() then
    raise exception 'Código de convite inválido ou vencido. Peça um novo ao dono do pet shop.' using errcode = 'P0001';
  end if;
  if exists (select 1 from membros where petshop_id = v.petshop_id and user_id = auth.uid()) then
    raise exception 'Você já faz parte deste pet shop.' using errcode = 'P0001';
  end if;
  update membros set user_id = auth.uid() where id = v.membro_id and user_id is null and ativo;
  if not found then
    raise exception 'Este convite já foi usado.' using errcode = 'P0001';
  end if;
  update convites set usado_em = now(), usado_por = auth.uid() where codigo = v.codigo;
  return v.petshop_id;
end $$;

revoke execute on function aceitar_convite(text) from public, anon;
grant execute on function aceitar_convite(text) to authenticated;
