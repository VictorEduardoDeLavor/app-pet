import type { Metadata } from "next";
import { DocumentoLegal, contato, quemOferece } from "@/components/documento-legal";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = { title: `Política de privacidade · ${MARCA.nome}` };

export default function Privacidade() {
  return (
    <DocumentoLegal titulo="Política de privacidade" atualizado="09/10/2026">
      <p>
        Esta política explica como o {MARCA.nome}, oferecido por {quemOferece()}, trata dados pessoais, em linha com a Lei Geral de Proteção de Dados (Lei
        13.709/2018, LGPD).
      </p>

      <h2>1. Papéis de cada um</h2>
      <ul>
        <li>
          <strong>Dados de quem usa o app</strong> (dono e equipe do pet shop): nós somos o controlador.
        </li>
        <li>
          <strong>Dados dos clientes do pet shop</strong> (tutores, pets, atendimentos, fotos e endereços): o pet shop é o controlador e nós somos o operador,
          tratando esses dados só para prestar o serviço contratado.
        </li>
      </ul>

      <h2>2. Que dados tratamos</h2>
      <ul>
        <li>Conta: nome, e-mail e senha (guardada de forma criptografada pelo nosso provedor de autenticação).</li>
        <li>Pet shop: nome, WhatsApp, endereço, horários e configurações.</li>
        <li>Cobrança da assinatura: nome ou razão social, CPF ou CNPJ e e-mail para as faturas.</li>
        <li>Cadastrados pelo pet shop: nome, WhatsApp, e-mail e endereço dos tutores; dados dos pets; agendamentos, valores, pacotes e comissões; fotos das etapas do atendimento.</li>
        <li>Localização do motorista: latitude, longitude e horário, só durante as viagens do leva e traz iniciadas por ele.</li>
        <li>Registros técnicos: data, hora e endereço IP de acesso, para segurança e para resolver problemas.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço e o suporte (execução de contrato, art. 7º, V, da LGPD).</li>
        <li>Cobrar a assinatura e cumprir obrigações fiscais (execução de contrato e obrigação legal, art. 7º, II e V).</li>
        <li>Proteger contas, evitar fraudes e melhorar o sistema (legítimo interesse, art. 7º, IX), sempre de forma compatível com o que você espera.</li>
      </ul>
      <p>Não vendemos dados e não usamos os dados dos seus clientes para publicidade.</p>

      <h2>4. Com quem compartilhamos</h2>
      <p>Usamos fornecedores que tratam dados em nosso nome, com contratos e medidas de segurança:</p>
      <ul>
        <li>Supabase: banco de dados, autenticação e armazenamento das fotos, com servidores em São Paulo.</li>
        <li>Vercel: hospedagem do site e do app (pode processar dados fora do Brasil, com garantias adequadas).</li>
        <li>Asaas: emissão e recebimento das cobranças da assinatura.</li>
        <li>OpenStreetMap: imagens do mapa do leva e traz, baixadas pelo navegador de quem vê o mapa.</li>
      </ul>
      <p>
        As mensagens de WhatsApp são enviadas pelo próprio pet shop, no aplicativo do WhatsApp dele; o {MARCA.nome} só prepara o texto. Também podemos compartilhar
        dados quando a lei ou uma ordem judicial exigir.
      </p>

      <h2>5. Link de acompanhamento e fotos</h2>
      <p>
        O link que o pet shop envia ao tutor tem um código aleatório de 32 caracteres e mostra apenas aquele atendimento: nome do pet, etapas, fotos, nome do
        motorista e, durante a viagem, a posição do carro. Ele não dá acesso a nenhum outro dado do pet shop.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Enquanto o pet shop tiver conta. Depois do cancelamento, os dados ficam guardados para o caso de retorno e são apagados em até 30 dias se o pet shop
        pedir. Registros de cobrança ficam pelo prazo exigido pela legislação fiscal.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Todo acesso é feito por conexão criptografada (HTTPS). Cada pet shop só enxerga os próprios dados, com regras aplicadas no próprio banco; cada pessoa da
        equipe vê só o que o seu papel permite (por exemplo, banhista e motorista não veem o financeiro).
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        Pela LGPD, o titular pode pedir confirmação, acesso, correção, anonimização, portabilidade, eliminação e informações sobre compartilhamento dos seus dados,
        além de revogar consentimentos. Tutores e clientes devem falar primeiro com o pet shop, que é o controlador; nós ajudamos o pet shop a atender. Usuários do
        app podem falar conosco {contato()}.
      </p>

      <h2>9. Armazenamento no navegador</h2>
      <p>
        Guardamos no seu navegador apenas o necessário para manter você conectado e lembrar preferências do app. Não usamos cookies de publicidade.
      </p>

      <h2>10. Encarregado e contato</h2>
      <p>Para assuntos de privacidade e proteção de dados, fale conosco {contato()}.</p>

      <h2>11. Mudanças</h2>
      <p>Se esta política mudar, avisaremos no app e a nova versão ficará nesta página.</p>
    </DocumentoLegal>
  );
}
