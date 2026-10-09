-- APP PET · 0008 · Modelo de mensagem "Acompanhe seu pet" nos pet shops que já existem
-- (separado da 0007 porque um valor novo de enum só pode ser usado depois de confirmado).

insert into mensagem_modelos (petshop_id, gatilho, titulo, texto, ativo)
select p.id, 'acompanhamento', 'Acompanhe seu pet',
       'Olá, {tutor}! {pet} está com a gente na {petshop}. Acompanhe cada etapa do banho, com fotos, por este link: {link}',
       true
from petshops p
where not exists (select 1 from mensagem_modelos m where m.petshop_id = p.id and m.gatilho = 'acompanhamento');
