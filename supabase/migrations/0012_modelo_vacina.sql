-- APP PET · 0012 · Modelo de mensagem do lembrete de vacina para os pet shops que já existem
-- (separado da 0011 porque o valor novo do enum só pode ser usado depois de gravado).

insert into mensagem_modelos (petshop_id, gatilho, titulo, texto)
select id, 'vacina', 'Vacina vencendo',
       'Olá, {tutor}! A {vacina} de {pet} vence {vencimento}. Mantenha a carteirinha em dia: é importante para a saúde dele e para o banho aqui na {petshop}.'
from petshops
on conflict (petshop_id, gatilho) do nothing;
