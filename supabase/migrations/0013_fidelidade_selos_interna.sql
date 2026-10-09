-- APP PET · 0013 · fidelidade_selos só é usada por dentro (link do tutor); o app calcula os selos no próprio Db.
revoke execute on function fidelidade_selos(uuid) from public, anon, authenticated;
