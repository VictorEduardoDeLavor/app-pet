import type { Metadata } from "next";
import { DocumentoLegal, contato, quemOferece } from "@/components/documento-legal";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = { title: `Termos de uso · ${MARCA.nome}` };

export default function Termos() {
  const preco = MARCA.precoMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <DocumentoLegal titulo="Termos de uso" atualizado="09/10/2026">
      <p>
        Estes termos valem entre o pet shop que cria a conta (&quot;você&quot;) e {quemOferece()} (&quot;nós&quot;). Ao criar o pet shop no {MARCA.nome} e marcar
        que leu e aceita, você concorda com eles e com a <a href="/privacidade">Política de privacidade</a>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O {MARCA.nome} é um sistema online para pet shops e banho e tosa: agenda, fila da equipe, ficha de clientes e pets, pacotes, financeiro, comissões,
        mensagens para WhatsApp, acompanhamento do atendimento pelo tutor com fotos e leva e traz com localização do motorista. Funciona no navegador do celular ou
        do computador.
      </p>

      <h2>2. Conta e equipe</h2>
      <p>
        Quem cria o pet shop é o dono da conta e responde pelo uso de toda a equipe que convidar. Cada pessoa entra com o próprio e-mail e senha, que não devem
        ser compartilhados. Avise-nos se suspeitar de acesso indevido.
      </p>

      <h2>3. Teste grátis, assinatura e cancelamento</h2>
      <ul>
        <li>Todo pet shop novo tem {MARCA.diasTeste} dias de teste grátis, com tudo liberado e sem pedir cartão.</li>
        <li>
          Depois do teste, o uso custa {preco} por mês (ou o valor mostrado na tela de assinatura no momento da contratação). A cobrança é mensal, por Pix, boleto
          ou cartão, processada pelo Asaas, instituição de pagamento parceira.
        </li>
        <li>Não há fidelidade nem multa. Você cancela quando quiser pela tela Assinatura do app; nada mais é cobrado e o acesso segue até o fim do período já pago.</li>
        <li>
          Se a mensalidade não for paga, há tolerância de 3 dias após o fim do período pago. Depois disso o acesso é suspenso até o pagamento, sem apagar os
          dados.
        </li>
        <li>Reajustes de preço são avisados no app e por e-mail com pelo menos 30 dias de antecedência e valem a partir da cobrança seguinte.</li>
      </ul>

      <h2>4. Uso permitido</h2>
      <p>
        Você se compromete a usar o {MARCA.nome} para a gestão do próprio pet shop, de acordo com a lei. Não é permitido usar o sistema para enviar mensagens em
        massa não solicitadas, guardar dados sem base legal, tentar acessar dados de outros pet shops ou prejudicar o funcionamento do serviço.
      </p>

      <h2>5. Dados dos seus clientes</h2>
      <p>
        Os dados de tutores, pets, atendimentos e fotos que você cadastra pertencem ao seu pet shop. Pela Lei Geral de Proteção de Dados (LGPD), o pet shop é o{" "}
        <strong>controlador</strong> desses dados e nós somos o <strong>operador</strong>: tratamos esses dados apenas para prestar o serviço e seguindo suas
        instruções. Cabe ao pet shop ter base legal para os dados que cadastra e informar seus clientes sobre o uso, inclusive das fotos e do link de
        acompanhamento.
      </p>

      <h2>6. Fotos e link de acompanhamento</h2>
      <p>
        Cada atendimento tem um link privado, com código aleatório, que mostra as etapas e as fotos do pet. Quem tiver o link consegue ver o andamento; por isso o
        pet shop decide para quem envia. As fotos ficam guardadas para a equipe e para esse link.
      </p>

      <h2>7. Localização do motorista</h2>
      <p>
        No leva e traz, o celular do motorista envia a localização só depois que ele toca em &quot;Saí para buscar&quot; ou &quot;Saí para entregar&quot;, com o app
        aberto, e para de enviar quando ele marca a chegada. O tutor vê o carro no mapa enquanto o pet está a caminho. O pet shop deve informar seus motoristas
        sobre esse uso antes de ativar o recurso.
      </p>

      <h2>8. Disponibilidade e suporte</h2>
      <p>
        Trabalhamos para manter o serviço no ar e os dados protegidos, mas podem acontecer interrupções para manutenção ou por falhas de terceiros (internet,
        hospedagem, operadoras). Atendemos o suporte {contato()}.
      </p>

      <h2>9. Responsabilidades</h2>
      <p>
        O {MARCA.nome} é uma ferramenta de apoio: decisões sobre preços, atendimentos, cobranças aos seus clientes e mensagens enviadas são do pet shop. Nossa
        responsabilidade por eventuais danos fica limitada ao valor pago pelo pet shop nos 12 meses anteriores ao ocorrido, salvo nos casos em que a lei não
        permitir essa limitação.
      </p>

      <h2>10. Fim da conta</h2>
      <p>
        Depois do cancelamento, os dados ficam guardados para o caso de você voltar. Se preferir que sejam apagados, peça {contato()}; apagaremos em até 30 dias,
        mantendo só o que a lei obrigar (por exemplo, registros de cobrança).
      </p>

      <h2>11. Mudanças nestes termos</h2>
      <p>Quando estes termos mudarem, avisaremos no app e pediremos um novo aceite do dono do pet shop.</p>

      <h2>12. Lei e foro</h2>
      <p>
        Valem as leis do Brasil. Fica eleito o foro da comarca de {MARCA.empresa.cidade} para resolver qualquer questão, sem prejuízo de outro foro garantido por lei.
      </p>
    </DocumentoLegal>
  );
}
