-- APP PET · 0009 · em_rota() é só de uso interno (chamada pelos triggers e pelo acompanhamento)
revoke execute on function em_rota(uuid) from public, anon, authenticated;
