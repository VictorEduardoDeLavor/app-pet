# APP PET

SaaS para pet shops e banho e tosa. Este repositório tem o **MVP para dono, recepção e banhista/tosador** com o visual "Minimalista lavanda", rodando como PWA no celular e com menu lateral no computador.

## No ar

- App: https://app-pet-one.vercel.app (Vercel, projeto `app-pet`)
- Banco: Supabase `app-pet` em São Paulo (`https://ytsimguduvxjfbesgzub.supabase.co`)
- Publicar uma versão nova: `vercel deploy --prod` na pasta do projeto (o `vercel.json` fixa o framework Next.js; as variáveis do Supabase já estão no projeto da Vercel).

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 78 testes: regras de negócio, assinatura, importação, Asaas e schema do Supabase
npm run build
```

No celular, abra o endereço no navegador e use **Adicionar à tela inicial**.

## O que já funciona

| Tela | Rota | O que faz |
| --- | --- | --- |
| Início | `/` | Indicadores do dia, planos a vencer, atalhos, atendimentos pendentes, clientes sumidos |
| Agenda | `/agenda` | Dia e semana, filtro por status, linha do tempo por hora |
| Novo agendamento | `/agenda/novo` | Tutor e pet (com cadastro rápido), serviços com preço por porte, horários livres por profissional, valor editável |
| Atendimento | `/atendimentos/[id]` | Alertas do pet, plano e saldo, iniciar, finalizar, cancelar, falta, trocar profissional, leva e traz, cobrar, WhatsApp, linha do tempo com fotos, link do tutor |
| Acompanhamento do tutor | `/acompanhar/[token]` | Página pública (sem senha) que o tutor abre pelo WhatsApp: etapa atual, barra de progresso, fotos de cada etapa, carro no mapa ao vivo durante o leva e traz. Atualiza sozinha e gera prévia com foto no WhatsApp |
| Leva e traz | `/rotas` | Lista do motorista: buscar, entregar, rota no Google Maps, ligar, avisar o tutor. "Saí para buscar/entregar" liga o GPS do celular; "Peguei/Entreguei" (com foto) desliga |
| Comissões | `/comissoes` | Quanto cada pessoa tem a receber desde o último pagamento, extrato por atendimento, registrar pagamento (vira despesa no caixa) |
| Esqueci a senha | `/entrar`, `/nova-senha` | Pede o link por e-mail e cria a senha nova |
| Financeiro | `/financeiro` | Caixa do dia, entradas e saídas, a receber, registrar pagamento, lançar despesa, fechar caixa, dias anteriores |
| Clientes | `/clientes`, `/clientes/[id]`, `/clientes/novo` | Busca por tutor, WhatsApp ou pet, filtros, ficha do tutor, histórico |
| Pet | `/pets/[id]` | Ficha completa, alertas, plano, histórico, editar |
| Planos | `/planos` | Ativos, a vencer, encerrados, vender plano, baixa manual, aviso de renovação |
| Mensagens | `/mensagens` | Fila do dia (pet pronto, confirmação, lembrete, feedback, renovação, sumidos) e 6 modelos editáveis |
| Minha fila | `/fila` | Tela do banhista/tosador: pet na mesa, próximos, alergias e cuidados em destaque, iniciar, registrar etapa com foto (chegou, banho, secagem, tosa, pronto), finalizar com foto do resultado, prontos do dia e comissão estimada |
| Equipe | `/equipe` | Pessoas e papéis, comissão própria opcional, convite por código de 6 letras para cada pessoa entrar com o próprio login |
| Mais | `/mais`, `/servicos`, `/produtos` | Serviços e preços por porte (com % de comissão), funcionamento, configurações, conta |
| Importar planilha | `/clientes/importar` | Clientes e pets de um Excel (.xlsx) ou CSV: modelo para baixar, colunas reconhecidas pelo cabeçalho (dá para ajustar), prévia, sem duplicar quem já existe |
| Assinatura | `/assinatura` | Dias de teste, plano R$ 49/mês, assinar (CPF/CNPJ e e-mail), faturas do Asaas com link de pagamento, cancelar |
| Painel do administrador | `/admin` | Só para quem está em `plataforma_admins`: pet shops, uso, situação da assinatura, receita mensal; estender teste, liberar, bloquear, mudar a mensalidade |
| Página de vendas | `/conheca` | Página pública com recursos, prints do app, preço, perguntas e botões de teste grátis e demonstração. Visitante sem conta em `/` cai aqui |
| Termos e privacidade | `/termos`, `/privacidade` | Rascunho (LGPD: pet shop controlador, plataforma operadora; fotos, link do tutor, GPS). Aceite obrigatório ao criar o pet shop |

## Quem vê o quê

| Papel | Vê | Não vê |
| --- | --- | --- |
| Dono | Tudo | — |
| Recepção | Início, agenda, clientes, mensagens, financeiro, planos, serviços | Equipe e configurações do pet shop |
| Banhista / tosador | Minha fila, ficha do pet, atendimento (iniciar, etapas com foto, finalizar) | Valores, financeiro, clientes, agenda geral, mensagens |
| Motorista | Leva e traz (endereço, telefone, etapas de transporte, GPS) | Valores, financeiro, agenda geral, fila do banho |

A tela esconde o que o papel não usa (`src/domain/permissoes.ts`) e o banco recusa o que o papel não pode (RLS). Quando o banhista finaliza, o pet aparece em **Pets prontos para buscar** no Início da recepção, com o botão de avisar o tutor no WhatsApp.

Comissão: % de cada serviço (tela Serviços e preços), ou a % própria da pessoa quando definida na Equipe, sempre sobre o preço de tabela, inclusive itens cobertos por plano. A mesma conta roda no app (estimativa na fila) e no banco (tabela `comissoes`).

No computador (a partir de 1024 px) a barra de baixo vira menu lateral, as folhas viram janelas centralizadas e o conteúdo ganha largura.

## Bibliotecas prontas usadas nas novidades

- **Leaflet + OpenStreetMap**: mapa do carro, aberto e sem chave de API. Com muitos acessos, trocar os "tiles" do OpenStreetMap por um provedor com plano (MapTiler, Stadia) mudando uma linha em `src/components/mapa.tsx`.
- **Geolocation API do navegador**: GPS do celular do motorista, sem app extra nem custo.
- **browser-image-compression**: reduz a foto da câmera (3–5 MB) para ~150 KB no próprio celular antes de subir.
- **Supabase Storage**: bucket público `fotos` com caminhos aleatórios; só a equipe do pet shop grava e lista a própria pasta.

## Assinatura do SaaS (teste grátis + Asaas)

- Todo pet shop nasce com **14 dias de teste** (`assinaturas.teste_ate`) e mensalidade de **R$ 49** (`assinaturas.valor`, ajustável por pet shop no painel).
- **Acesso:** liberado no teste, com a mensalidade paga até `pago_ate` (+3 dias de tolerância) ou com `liberado_ate` dado pelo administrador. Fora disso o RLS fecha as tabelas de operação (`meus_petshops()` e `tem_papel()` passam por `assinatura_liberada()`); dono e equipe ainda veem o pet shop e a situação para regularizar. Nada é apagado.
- **Cobrança:** Edge Function `assinatura` cria o cliente e a assinatura mensal no Asaas (`billingType: UNDEFINED`: o pet shop escolhe Pix, boleto ou cartão na fatura), com o primeiro vencimento no fim do teste. Ações: `assinar`, `sincronizar`, `cancelar`.
- **Webhook:** Edge Function `asaas-webhook` confere o header `asaas-access-token` e chama `asaas_processar_evento()` (grava o evento uma vez, atualiza as faturas, recalcula `pago_ate`).
- **Segredos das Edge Functions** (Supabase → Edge Functions → Secrets): `ASAAS_API_KEY` (chave do Asaas; `$aact_hmlg_` = sandbox, `$aact_prod_` = produção) e `ASAAS_WEBHOOK_TOKEN` (o mesmo token cadastrado no webhook do Asaas, URL `https://ytsimguduvxjfbesgzub.supabase.co/functions/v1/asaas-webhook`). Sem a chave, o botão Assinar avisa que o pagamento online ainda não está ligado e o administrador libera à mão.
- Nome, preço, dias de teste, contato do suporte e versão dos termos ficam em `src/lib/marca.ts`.

## Como está organizado

```
src/domain/       regras de negócio puras (rules.ts) + mensagens + formatação, com testes
src/data/         estado do protótipo (Zustand + localStorage) e dados de exemplo
src/components/   UI base, navegação, folhas de WhatsApp, pagamento e pet
src/app/(app)/    telas
supabase/         migrations (0001 schema; 0002–0005 convites e comissão; 0006 advisors; 0007–0009 acompanhamento e leva e traz; 0010 assinatura, admin e termos) + Edge Functions (assinatura, asaas-webhook) + teste do schema em Postgres embutido (PGlite)
```

As regras vivem em dois lugares que espelham uma à outra:

- `src/domain/rules.ts` roda no protótipo (sem servidor).
- `supabase/migrations/` aplica as mesmas regras no banco: transição de status validada, baixa de plano ao finalizar, receita pendente, comissão, conflito de horário (exclusion constraint), RLS por pet shop e por papel.

## Modos de uso

- **Demonstração:** sem variáveis do Supabase, o app abre direto com dados de exemplo salvos no navegador. Em **Mais → Ver o app como** dá para trocar entre dona, recepção e banhistas.
- **Nuvem:** com as variáveis configuradas, o app pede login. Quem cria a conta passa pela tela "Vamos configurar seu pet shop", que já cadastra serviços, preços por porte, pacotes e mensagens padrão. Daí em diante, cada ação grava no banco e a tela recarrega do Supabase. A demonstração continua disponível pelo link "Ver demonstração" na tela de entrada.
- **Convite da equipe:** o dono cadastra a pessoa em Equipe e gera o código. A pessoa abre o link `/entrar?convite=CÓDIGO`, cria a conta e escolhe "Tenho um convite" (o código já vem preenchido). O código vale 7 dias e é de uso único.

## Ligar no Supabase

1. Criar o projeto (região São Paulo, `sa-east-1`) e rodar, em ordem, os arquivos de `supabase/migrations/` no SQL Editor. O projeto atual é `app-pet` (`https://ytsimguduvxjfbesgzub.supabase.co`), com as 6 migrations já aplicadas.
2. Em **Authentication → URL Configuration**, colocar a URL publicada do app em **Site URL**. O link de confirmação de e-mail volta para lá.
3. Copiar `.env.example` para `.env.local` (e para as variáveis do projeto na Vercel) com a URL do projeto e a chave anon/publishable.
4. **Antes de abrir para clientes:** a confirmação de e-mail vem ligada e o e-mail padrão do Supabase só envia para membros da sua organização, então um cadastro novo não consegue entrar. Configure um SMTP próprio (Resend, por exemplo) em **Authentication → Emails → SMTP Settings**, ou desligue **Confirm email** em **Authentication → Sign In / Providers → Email** enquanto testa.
5. Advisors: os avisos que sobram são intencionais. `criar_petshop`, `fechar_caixa`, `gerar_convite` e `aceitar_convite` são RPCs chamadas pelo app (com checagem de login e papel dentro); `meus_petshops`, `tem_papel` e `membro_atual` são usadas pelo RLS e só devolvem dados de quem está logado.

## Dados de exemplo

O protótipo abre com o "Patinhas Pet Shop" e dados fictícios relativos ao dia de hoje. Eles ficam no navegador e são recriados a cada dia; em **Mais → Restaurar dados de exemplo** dá para voltar ao início.
