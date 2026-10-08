-- APP PET · 0006 · Ajustes apontados pelos advisors do Supabase

-- search_path fixo também na função de transição de status.
alter function transicao_valida(status_atendimento, status_atendimento) set search_path = public;

-- Funções de trigger não fazem parte da API: só o banco as chama.
revoke execute on function atendimento_evento_inicial(), atendimento_mudou_status(), lancamento_pago(), plano_sincroniza_status()
  from public, anon, authenticated;

-- Índices nas chaves estrangeiras (o RLS e a carga do app filtram por petshop_id em todas as tabelas).
create index if not exists atendimento_eventos_atendimento_idx on atendimento_eventos (atendimento_id);
create index if not exists atendimento_eventos_membro_idx on atendimento_eventos (membro_id);
create index if not exists atendimento_eventos_petshop_idx on atendimento_eventos (petshop_id);
create index if not exists atendimento_fotos_atendimento_idx on atendimento_fotos (atendimento_id);
create index if not exists atendimento_fotos_petshop_idx on atendimento_fotos (petshop_id);
create index if not exists atendimento_itens_petshop_idx on atendimento_itens (petshop_id);
create index if not exists atendimento_itens_servico_idx on atendimento_itens (servico_id);
create index if not exists atendimentos_plano_pet_idx on atendimentos (plano_pet_id);
create index if not exists atendimentos_tutor_idx on atendimentos (tutor_id);
create index if not exists caixas_fechado_por_idx on caixas (fechado_por);
create index if not exists comissoes_membro_idx on comissoes (membro_id);
create index if not exists comissoes_petshop_idx on comissoes (petshop_id);
create index if not exists convites_usado_por_idx on convites (usado_por);
create index if not exists lancamentos_atendimento_idx on lancamentos (atendimento_id);
create index if not exists lancamentos_plano_pet_idx on lancamentos (plano_pet_id);
create index if not exists membros_user_idx on membros (user_id);
create index if not exists mensagens_envios_atendimento_idx on mensagens_envios (atendimento_id);
create index if not exists mensagens_envios_modelo_idx on mensagens_envios (modelo_id);
create index if not exists mensagens_envios_petshop_idx on mensagens_envios (petshop_id);
create index if not exists mensagens_envios_tutor_idx on mensagens_envios (tutor_id);
create index if not exists pets_petshop_idx on pets (petshop_id);
create index if not exists plano_usos_petshop_idx on plano_usos (petshop_id);
create index if not exists planos_modelo_petshop_idx on planos_modelo (petshop_id);
create index if not exists planos_pet_modelo_idx on planos_pet (modelo_id);
create index if not exists planos_pet_petshop_idx on planos_pet (petshop_id);
create index if not exists planos_pet_tutor_idx on planos_pet (tutor_id);
create index if not exists servico_precos_petshop_idx on servico_precos (petshop_id);
create index if not exists servicos_petshop_idx on servicos (petshop_id);
create index if not exists tutores_user_idx on tutores (user_id);
