/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Calendar,
  CalendarX,
  Camera,
  Car,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Globe,
  HandCoins,
  ListChecks,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Package,
  PawPrint,
  PiggyBank,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stamp,
  Store,
  Syringe,
  TriangleAlert,
  UserCog,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { MARCA, linkSuporte } from "@/lib/marca";

const preco = `R$ ${MARCA.precoMensal}`;

export const metadata: Metadata = {
  title: `Sistema para banho e tosa online · ${MARCA.nome}`,
  description: `Agenda, agendamento online com sinal por Pix, fila da equipe, pacotes, estoque, caixa e relatórios. A tutora acompanha o banho com fotos e o leva e traz no mapa, por um link no WhatsApp. ${MARCA.diasTeste} dias grátis.`,
  openGraph: {
    title: `${MARCA.nome} · sistema para banho e tosa`,
    description: `Agendamento online com sinal por Pix, fotos de cada etapa para a tutora e leva e traz no mapa. ${MARCA.diasTeste} dias grátis, depois ${preco}/mês.`,
    images: [{ url: "/fotos/og-conheca.jpg", width: 1200, height: 630 }],
    locale: "pt_BR",
    type: "website",
  },
};

const CRIAR = "/entrar?criar=1";
const DEMO = "/entrar?demo=1";

export default function Conheca() {
  const suporte = linkSuporte(`Olá! Quero saber mais sobre o ${MARCA.nome}.`);
  return (
    <div className="overflow-x-clip">
      <Topo />
      <Hero />
      <Faixa />
      <Dores />
      <Tutora />
      <AgendamentoOnline />
      <FichaDoPet />
      <Recursos />
      <Gestao />
      <Equipe />
      <Passos />
      <Preco />
      <Perguntas />
      <Final />
      <Rodape suporte={suporte} />
      {suporte && <BotaoWhatsapp href={suporte} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1120px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${claro ? "text-white" : "text-brand-700"}`}>
      <PawPrint className="h-7 w-7" strokeWidth={2.2} />
      <span className="text-[18px] font-bold tracking-tight">{MARCA.nome}</span>
    </span>
  );
}

function BotaoCta({ href, children, variante = "primario" }: { href: string; children: ReactNode; variante?: "primario" | "claro" | "vidro" }) {
  const estilo =
    variante === "primario"
      ? "botao-primario text-white"
      : variante === "claro"
        ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200 hover:bg-brand-50"
        : "bg-white/15 text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/25";
  return (
    <a href={href} className={`tap inline-flex h-[52px] items-center whitespace-nowrap justify-center gap-2 rounded-2xl px-6 text-[15.5px] font-semibold ${estilo}`}>
      {children}
    </a>
  );
}

function Celular({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={className}>
      <div className="relative rounded-[42px] bg-[#16122a] p-[9px] shadow-[0_40px_80px_-30px_rgb(52_33_130/0.55),0_0_0_1px_rgb(255_255_255/0.08)_inset]">
        <div className="absolute left-1/2 top-[14px] z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-[#16122a]" />
        <img src={src} alt={alt} loading="lazy" className="block h-auto w-full rounded-[34px]" width={585} height={1200} />
      </div>
    </div>
  );
}

/** Janela de navegador para mostrar o app no computador. */
function Navegador({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[18px] bg-white shadow-[0_40px_80px_-36px_rgb(52_33_130/0.5)] ring-1 ring-brand-100 ${className}`}>
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 hidden h-6 flex-1 items-center rounded-md bg-white px-3 text-[11.5px] text-subtle ring-1 ring-line sm:flex">app-pet-one.vercel.app</span>
      </div>
      <img src={src} alt={alt} loading="lazy" className="block h-auto w-full" width={1440} height={900} />
    </div>
  );
}

function Rotulo({ children, claro = false }: { children: ReactNode; claro?: boolean }) {
  return <p className={`text-[13px] font-semibold uppercase tracking-[0.16em] ${claro ? "text-brand-200" : "text-brand-600"}`}>{children}</p>;
}

function Titulo({ children, claro = false, className = "" }: { children: ReactNode; claro?: boolean; className?: string }) {
  return <h2 className={`mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px] ${claro ? "text-white" : ""} ${className}`}>{children}</h2>;
}

function Ponto({ icone, titulo, texto, claro = false }: { icone: ReactNode; titulo: string; texto: string; claro?: boolean }) {
  return (
    <li className="flex gap-4">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl [&>svg]:h-5 [&>svg]:w-5 ${
          claro ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-brand-600 text-white shadow-[var(--shadow-float)]"
        }`}
      >
        {icone}
      </span>
      <span>
        <span className={`block text-[16.5px] font-semibold ${claro ? "text-white" : ""}`}>{titulo}</span>
        <span className={`block text-[15px] leading-relaxed ${claro ? "text-white/75" : "text-muted"}`}>{texto}</span>
      </span>
    </li>
  );
}

function Selo({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Check className="h-4 w-4 text-ok-500" strokeWidth={2.6} /> {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Seções

function Topo() {
  const links = [
    ["#recursos", "Recursos"],
    ["#agendamento", "Agendamento online"],
    ["#preco", "Preço"],
    ["#perguntas", "Dúvidas"],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="/conheca" aria-label={MARCA.nome}>
          <Logo />
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map(([href, texto]) => (
            <a key={href} href={href} className="hidden rounded-full px-3 py-2 text-[14.5px] font-medium text-muted hover:text-ink lg:block">
              {texto}
            </a>
          ))}
          <a href="/entrar" className="rounded-full px-3 py-2 text-[14.5px] font-semibold text-brand-700">
            Entrar
          </a>
          <a href={CRIAR} className="botao-primario tap hidden rounded-full px-4 py-2 text-[14px] font-semibold text-white sm:block">
            Testar grátis
          </a>
        </nav>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      <Container className="grid items-center gap-12 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
            <Sparkles className="h-4 w-4" /> Sistema para banho e tosa online
          </p>
          <h1 className="mt-5 text-[40px] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[54px]">
            Seu banho e tosa organizado. <span className="text-brand-600">A tutora acompanhando cada etapa.</span>
          </h1>
          <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-muted sm:text-[18.5px]">
            Agenda, agendamento online com sinal por Pix, fila da equipe, pacotes e caixa num lugar só. E um link no WhatsApp para a tutora ver as fotos do
            banho e o carro chegando no mapa.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <BotaoCta href={CRIAR}>Testar {MARCA.diasTeste} dias grátis</BotaoCta>
            <BotaoCta href={DEMO} variante="claro">
              Ver demonstração
            </BotaoCta>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
            <Selo>Sem cartão</Selo>
            <Selo>{preco}/mês depois</Selo>
            <Selo>Cancele quando quiser</Selo>
          </p>
        </div>

        <div className="relative mx-auto h-[470px] w-full max-w-[460px] sm:h-[620px]">
          <div aria-hidden className="absolute inset-x-6 top-10 bottom-10 rounded-[48px] bg-gradient-to-br from-brand-200 via-brand-100 to-white" />
          <Celular src="/fotos/app/inicio.webp" alt="Tela inicial do dono com a agenda do dia" className="absolute left-0 top-12 w-[52%] rotate-[-6deg] opacity-95" />
          <Celular src="/fotos/app/tutor-fotos.webp" alt="Página que a tutora recebe: Thor está no banho, com fotos de cada etapa" className="absolute right-0 top-0 w-[58%]" />
          <div className="absolute bottom-8 left-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-brand-100 sm:left-6">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white">
              <Camera className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold">Thor está no banho</span>
              <span className="block text-[12.5px] text-muted">&quot;Shampoo sem perfume, como pedido.&quot;</span>
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Faixa() {
  const itens = [
    { i: <MonitorSmartphone className="h-5 w-5" />, t: "Celular, computador ou tablet. Instala como app" },
    { i: <Globe className="h-5 w-5" />, t: "A tutora agenda sozinha pelo seu link" },
    { i: <Users className="h-5 w-5" />, t: "Equipe, clientes e pets sem limite" },
    { i: <BadgeCheck className="h-5 w-5" />, t: "Sem fidelidade e sem taxa sobre o que você recebe" },
  ];
  return (
    <section className="border-y border-brand-100 bg-white/70">
      <Container className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map((x) => (
          <p key={x.t} className="flex items-center gap-3 text-[14.5px] font-medium text-ink/85">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{x.i}</span>
            {x.t}
          </p>
        ))}
      </Container>
    </section>
  );
}

function Dores() {
  const dores = [
    { i: <MessageCircle />, t: "Passa o dia respondendo “que horas tem?” e “já está pronto?” no WhatsApp." },
    { i: <CalendarX />, t: "Marca no caderno e, de vez em quando, encaixa dois pets no mesmo horário." },
    { i: <UserX />, t: "Perde o horário e o dinheiro com cliente que marca e não aparece." },
    { i: <TriangleAlert />, t: "Precisa lembrar de cabeça quem tem alergia a perfume ou não gosta do secador." },
    { i: <Package />, t: "Vende pacote de banhos e se perde em quantos já foram usados." },
    { i: <PiggyBank />, t: "Fecha o mês sem saber quanto entrou, quanto saiu e quanto sobrou." },
  ];
  return (
    <section className="py-20 lg:py-28">
      <Container>
        <div className="mx-auto max-w-[680px] text-center">
          <Rotulo>Para quem é</Rotulo>
          <Titulo>Feito para o banho e tosa que vive no WhatsApp.</Titulo>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Se alguma destas frases parece a sua semana, o {MARCA.nome} foi pensado para você.</p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dores.map((d) => (
            <li key={d.t} className="flex gap-4 rounded-[22px] bg-white p-5 ring-1 ring-line">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 [&>svg]:h-5 [&>svg]:w-5">{d.i}</span>
              <p className="text-[15.5px] leading-relaxed text-ink/85">{d.t}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex justify-center">
          <BotaoCta href={CRIAR}>
            Organizar meu banho e tosa <ArrowRight className="h-5 w-5" />
          </BotaoCta>
        </div>
      </Container>
    </section>
  );
}

function Tutora() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div className="order-2 mx-auto w-full max-w-[300px] lg:order-1">
          <Celular src="/fotos/app/tutor-mapa.webp" alt="Página da tutora com o carro do leva e traz no mapa" />
        </div>
        <div className="order-1 lg:order-2">
          <Rotulo>O diferencial</Rotulo>
          <Titulo>Menos &quot;já está pronto?&quot; no WhatsApp. Mais tutora voltando.</Titulo>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Quem deixa o pet quer saber como ele está. Com o {MARCA.nome}, a tutora acompanha tudo sozinha e o seu atendimento vira assunto no grupo da família.
          </p>
          <ul className="mt-8 space-y-5">
            <Ponto icone={<MessageCircle />} titulo="Um link privado por atendimento" texto="Enviado no WhatsApp com um toque. A tutora não baixa app nem cria senha." />
            <Ponto icone={<Camera />} titulo="Fotos de cada etapa" texto="Chegou, banho, secagem, tosa e pronto, com recadinhos da equipe e o logo do seu pet shop." />
            <Ponto icone={<MapPin />} titulo="O carro no mapa, ao vivo" texto="No leva e traz, ela vê o motorista chegando para buscar e para entregar." />
            <Ponto icone={<Stamp />} titulo="Cartão fidelidade no mesmo link" texto="Ela vê quantos selos já tem e quanto falta para o próximo banho de presente." />
          </ul>
        </div>
      </Container>
    </section>
  );
}

function AgendamentoOnline() {
  return (
    <section id="agendamento" className="relative scroll-mt-16 overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 py-20 text-white lg:py-28">
      <div aria-hidden className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -left-24 h-[380px] w-[380px] rounded-full bg-brand-400/30 blur-3xl" />
      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Rotulo claro>Agendamento online</Rotulo>
          <Titulo claro>Seu link de agendamento. A tutora marca sozinha, até de madrugada.</Titulo>
          <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-white/80">
            Coloque o link na bio do Instagram e no status do WhatsApp. Ela escolhe o porte, os serviços e um horário livre de verdade, e o pedido cai na sua
            agenda.
          </p>
          <ul className="mt-8 space-y-5">
            <Ponto claro icone={<Store />} titulo="Uma página com a cara do seu pet shop" texto="Nome, logo, endereço, serviços com preço por porte e só os horários que a equipe consegue atender." />
            <Ponto claro icone={<QrCode />} titulo="Sinal por Pix para segurar o horário" texto="Você escolhe a porcentagem. O Pix vai direto para a sua chave, sem taxa do app, e você confere no seu banco." />
            <Ponto claro icone={<Calendar />} titulo="Cai direto na agenda" texto="O pedido aparece com o selo Online no Início para você confirmar com um toque." />
            <Ponto claro icone={<Smartphone />} titulo="Sem app e sem senha para a tutora" texto="Abre no navegador do celular. No dia, o mesmo link mostra as fotos do banho." />
          </ul>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <BotaoCta href={CRIAR} variante="claro">
              Quero meu link
            </BotaoCta>
            <BotaoCta href="/agendar/patinhas" variante="vidro">
              Ver página de exemplo
            </BotaoCta>
          </div>
        </div>
        <div className="relative mx-auto h-[500px] w-full max-w-[460px] sm:h-[600px]">
          <Celular src="/fotos/app/agendar.webp" alt="Página de agendamento: porte, serviços com preço e total com o sinal por Pix" className="absolute left-0 top-0 w-[52%]" />
          <Celular src="/fotos/app/agendar-pix.webp" alt="Pedido enviado com o código Pix do sinal" className="absolute bottom-0 right-0 w-[52%] rotate-[4deg]" />
          <div className="absolute bottom-10 left-0 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-[var(--shadow-card)] sm:left-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ok-500 text-white">
              <Check className="h-5 w-5" strokeWidth={2.6} />
            </span>
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold">Novo pedido online</span>
              <span className="block text-[12.5px] text-muted">Bolinha · sexta, 10h · sinal R$ 27</span>
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FichaDoPet() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative order-2 mx-auto w-full max-w-[300px] lg:order-1">
          <Celular src="/fotos/app/ficha-pet.webp" alt="Ficha do pet com raça por busca, porte, pelagem e temperamento em botões" />
          <div className="absolute -right-4 top-[44%] flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-[var(--shadow-card)] ring-1 ring-brand-100 sm:-right-14">
            <Search className="h-4 w-4 text-brand-600" />
            <span className="text-[13.5px]">
              <span className="text-muted line-through decoration-brand-300">shitzu</span> <ArrowRight className="inline h-3.5 w-3.5 text-subtle" />{" "}
              <span className="font-semibold">Shih-tzu</span>
            </span>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <Rotulo>Ficha do pet</Rotulo>
          <Titulo>Cadastro em segundos, quase sem digitar.</Titulo>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Tudo o que a equipe precisa saber antes de pegar o pet, do jeito que se fala no balcão.</p>
          <ul className="mt-8 space-y-5">
            <Ponto icone={<Search />} titulo="Raça com busca" texto="Mais de 120 raças de cães e gatos. Digite “lulu” ou “shitzu” e o app acha o nome certo." />
            <Ponto icone={<PawPrint />} titulo="Pelagem, temperamento e alergia por toque" texto="Curta, média ou longa. Tranquilo, agitado, medroso ou bravo. Sem campo em branco para adivinhar." />
            <Ponto icone={<TriangleAlert />} titulo="Alerta onde importa" texto="Alergia e pet bravo aparecem em destaque na agenda e na tela do banhista." />
            <Ponto icone={<Syringe />} titulo="Vacinas e vermífugo com vencimento" texto="O app mostra quem está vencendo e a mensagem para a tutora já sai pronta." />
          </ul>
        </div>
      </Container>
    </section>
  );
}

function Recursos() {
  const lista = [
    { i: <Calendar />, t: "Agenda sem conflito", d: "Preço e duração por porte. O sistema não deixa marcar dois pets no mesmo horário para a mesma pessoa." },
    { i: <ListChecks />, t: "Fila do banhista", d: "Cada um vê os pets do dia, os alertas, registra as etapas com foto e finaliza." },
    { i: <Car />, t: "Leva e traz com GPS", d: "Rotas do dia, rota no Google Maps, endereço pelo CEP e o motorista no mapa da tutora." },
    { i: <Package />, t: "Pacotes e planos", d: "Venda pacotes de banhos. Cada atendimento desconta sozinho e avisa quando está acabando." },
    { i: <Store />, t: "Produtos e estoque", d: "Venda no balcão ou junto com o banho, margem de lucro e aviso de estoque baixo." },
    { i: <Wallet />, t: "Financeiro e caixa", d: "Receitas, despesas, pagamentos por Pix, cartão ou dinheiro e o fechamento do dia." },
    { i: <BarChart3 />, t: "Relatórios", d: "Faturamento, ticket médio, serviços, clientes e equipe, comparando com o período anterior." },
    { i: <HandCoins />, t: "Comissões", d: "Por serviço ou por pessoa, com extrato e pagamento lançado no caixa." },
    { i: <Stamp />, t: "Cartão fidelidade", d: "A cada banho um selo. Completou, o prêmio vira desconto no próximo atendimento." },
    { i: <Syringe />, t: "Vacinas em dia", d: "Vacina, vermífugo e antipulgas com vencimento e lembrete pronto para a tutora." },
    { i: <MessageCircle />, t: "Mensagens prontas", d: "Confirmação, lembrete, pet pronto, vacina e cliente sumido, enviadas do seu WhatsApp." },
    { i: <FileSpreadsheet />, t: "Importar planilha", d: "Traga clientes e pets do Excel ou de outro sistema, sem duplicar ninguém." },
  ];
  return (
    <section id="recursos" className="scroll-mt-16 bg-white py-20 lg:py-28">
      <Container>
        <div className="max-w-[640px]">
          <Rotulo>Tudo do dia a dia</Rotulo>
          <Titulo>Do agendamento ao caixa, sem caderno e sem planilha.</Titulo>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lista.map((r) => (
            <li key={r.t} className="rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 [&>svg]:h-5 [&>svg]:w-5">{r.i}</span>
              <p className="mt-4 text-[16.5px] font-semibold">{r.t}</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{r.d}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Gestao() {
  const itens = [
    "Entrou, saiu e sobrou, com ticket médio e comparação com o período anterior",
    "Os serviços que mais faturam e os clientes que mais gastam",
    "Lucro dos produtos, comissões da equipe e faltas do período",
    "Exporta planilha para o Excel quando o contador pedir",
  ];
  return (
    <section className="py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.15fr]">
        <div>
          <Rotulo>Gestão</Rotulo>
          <Titulo>Saiba quanto entrou, quanto saiu e o que dá mais lucro.</Titulo>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Cada atendimento finalizado e cada venda vão para o caixa. Os relatórios se montam sozinhos, do dia, da semana ou do mês.
          </p>
          <ul className="mt-7 space-y-3">
            {itens.map((t) => (
              <li key={t} className="flex gap-3 text-[15.5px]">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-ok-500" strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-7 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[14.5px] text-ink/85 ring-1 ring-line">
            <MonitorSmartphone className="h-5 w-5 shrink-0 text-brand-600" />
            No balcão pelo computador, no banho pelo celular. Instale na tela inicial e abra como um app.
          </p>
        </div>
        <div className="relative pb-16 sm:pb-24">
          <Navegador src="/fotos/app/computador.webp" alt="O app aberto no computador, com o menu lateral e o resumo do dia" />
          <Celular src="/fotos/app/relatorios.webp" alt="Relatórios no celular: entradas, saídas, saldo e ticket médio" className="absolute -bottom-2 right-2 w-[36%] max-w-[200px] sm:right-6" />
        </div>
      </Container>
    </section>
  );
}

function Equipe() {
  const papeis = [
    { t: "Dono", d: "Vê tudo: agenda, financeiro, comissões, equipe e assinatura." },
    { t: "Recepção", d: "Agenda, clientes, pacotes, mensagens e caixa." },
    { t: "Banhista e tosador", d: "Só a própria fila e as fotos, sem ver valores." },
    { t: "Motorista", d: "Só as rotas do leva e traz, com endereço e telefone." },
  ];
  return (
    <section className="bg-white py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Rotulo>Cada um no seu lugar</Rotulo>
          <Titulo>A equipe toda no mesmo app, cada um vendo o que precisa.</Titulo>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Convide por um código de 6 letras. Cada pessoa entra com o próprio e-mail e o acesso segue a função dela.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {papeis.map((p) => (
              <li key={p.t} className="rounded-[20px] bg-surface px-4 py-4">
                <p className="flex items-center gap-2 text-[15.5px] font-semibold">
                  <UserCog className="h-[18px] w-[18px] text-brand-600" /> {p.t}
                </p>
                <p className="mt-1 text-[14px] text-muted">{p.d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-[300px]">
          <Celular src="/fotos/app/fila.webp" alt="Fila do banhista com o pet do momento, alergias e etapas" />
        </div>
      </Container>
    </section>
  );
}

function Passos() {
  const passos = [
    { n: "1", t: "Crie a conta", d: "Serviços, preços por porte, pacotes e mensagens já vêm prontos para ajustar." },
    { n: "2", t: "Traga seus clientes", d: "Importe de uma planilha do Excel ou de outro sistema, ou cadastre na hora." },
    { n: "3", t: "Divulgue seu link", d: "Ligue o agendamento online, convide a equipe e mande o primeiro acompanhamento." },
  ];
  return (
    <section className="py-20 lg:py-24">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-[560px]">
            <Rotulo>Comece hoje</Rotulo>
            <Titulo>Pronto para usar em poucos minutos.</Titulo>
          </div>
          <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-medium text-brand-700 ring-1 ring-brand-100">
            <FileSpreadsheet className="h-4 w-4" /> Modelo de planilha incluso
          </p>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {passos.map((p) => (
            <li key={p.n} className="relative rounded-[24px] bg-white p-6 ring-1 ring-line">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-[16px] font-bold text-white">{p.n}</span>
              <p className="mt-4 text-[17px] font-semibold">{p.t}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.d}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function Preco() {
  const inclui = [
    "Todos os recursos, sem plano limitado",
    "Equipe, clientes e pets sem limite",
    "Agendamento online com sinal por Pix",
    "Acompanhamento com fotos e leva e traz com GPS",
    "Mensagens pelo seu WhatsApp, sem custo por envio",
    "Importação de clientes por planilha",
    "Atualizações sem custo extra",
  ];
  return (
    <section id="preco" className="scroll-mt-16 bg-white py-20 lg:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Rotulo>Preço</Rotulo>
          <Titulo>Um plano, tudo incluso.</Titulo>
          <p className="mt-4 max-w-[480px] text-[17px] leading-relaxed text-muted">
            Teste {MARCA.diasTeste} dias com tudo liberado e sem cartão. Se gostar, assine pelo próprio app. Se não, é só não assinar.
          </p>
          <ul className="mt-7 max-w-[480px] space-y-3 text-[15px] text-ink/85">
            <li className="flex gap-3">
              <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              O sinal e os pagamentos dos seus clientes vão direto para você. O app não cobra porcentagem.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              Sem fidelidade e sem multa. Se a assinatura parar, seus dados continuam guardados.
            </li>
          </ul>
        </div>
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-hero)] ring-1 ring-brand-100">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-7 pb-7 pt-7 text-white">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70">{MARCA.nome} completo</p>
            <p className="mt-2 text-[52px] font-bold leading-none tracking-tight">
              {preco}
              <span className="text-[18px] font-medium text-white/75">/mês</span>
            </p>
            <p className="mt-2 text-[14.5px] text-white/80">{MARCA.diasTeste} dias grátis · sem fidelidade · Pix, boleto ou cartão</p>
          </div>
          <ul className="space-y-3 px-7 py-6">
            {inclui.map((t) => (
              <li key={t} className="flex gap-3 text-[15px]">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-ok-500" strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
          <div className="px-7 pb-7">
            <a href={CRIAR} className="botao-primario tap flex h-[54px] items-center justify-center rounded-2xl text-[16px] font-semibold text-white">
              Começar o teste grátis
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Perguntas() {
  const faq = [
    ["Preciso instalar alguma coisa?", "Não. Abre no navegador do celular, do computador ou do tablet. No celular, dá para instalar na tela inicial e abrir como um app."],
    ["A tutora precisa baixar app ou criar senha?", "Não. Ela recebe um link no WhatsApp e acompanha por ali, com fotos e, no leva e traz, o carro no mapa. Para agendar, usa o link do seu pet shop."],
    [
      "Como funciona o agendamento online?",
      "Você liga em Dados do pet shop e ganha um link com o nome do seu pet shop. A tutora escolhe porte, serviços, dia e um horário livre. Se quiser, peça um sinal por Pix: o código já sai com o valor e vai para a sua chave.",
    ],
    ["O app cobra taxa sobre o sinal ou os pagamentos?", "Não. O Pix do sinal vai direto para a sua chave e o que você recebe no balcão é seu. Você paga só a mensalidade."],
    [
      "As mensagens do WhatsApp saem sozinhas?",
      "Ainda não. As mensagens já vêm escritas com o nome do pet, o horário e o link. Você toca no botão e o WhatsApp abre com o texto pronto para enviar, do seu próprio número e sem custo por mensagem.",
    ],
    ["Atende gatos?", "Sim. A ficha tem raças de cães e de gatos, e o agendamento online pergunta a espécie."],
    ["Como funciona o teste grátis?", `São ${MARCA.diasTeste} dias com tudo liberado, sem cartão. Para continuar depois, assine na tela Assinatura do app.`],
    ["Como eu pago a mensalidade?", `${preco} por mês, por Pix, boleto ou cartão. Sem fidelidade e sem multa: cancele quando quiser pelo próprio app.`],
    ["Uso outro sistema. Consigo trazer meus clientes?", "Sim. Exporte uma planilha do sistema antigo (Excel ou CSV) e importe. O app reconhece as colunas e não duplica quem já está cadastrado."],
    ["Como funciona o GPS do motorista?", "Pelo celular do motorista: ele toca em “Saí para buscar” e o app manda a posição enquanto estiver aberto na tela. Ao chegar, desliga sozinho."],
    ["Tem limite de clientes, pets ou equipe?", "Não. O preço é o mesmo para qualquer tamanho de pet shop."],
    ["Meus dados ficam seguros?", "Cada pet shop só enxerga os próprios dados, com regras aplicadas no banco. Banhista e motorista não veem o financeiro. Os detalhes estão na política de privacidade."],
  ];
  return (
    <section id="perguntas" className="scroll-mt-16 py-20 lg:py-28">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Rotulo>Dúvidas</Rotulo>
          <Titulo>Perguntas frequentes</Titulo>
          <p className="mt-4 max-w-[340px] text-[16px] leading-relaxed text-muted">
            Ficou alguma? Abra a demonstração e veja o app por dentro, com dados de exemplo.
          </p>
          <div className="mt-6">
            <BotaoCta href={DEMO} variante="claro">
              Ver demonstração
            </BotaoCta>
          </div>
        </div>
        <div className="divide-y divide-line rounded-[24px] border border-line bg-white">
          {faq.map(([q, r]) => (
            <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{r}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Final() {
  return (
    <section className="pb-16 lg:pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-[32px] px-6 py-14 text-center shadow-[var(--shadow-hero)] sm:px-12 lg:py-20">
          <img src="/fotos/capa-banho.webp" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 60%" }} />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(40_26_99/0.55),rgb(29_18_74/0.88))]" />
          <div className="relative">
            <h2 className="mx-auto max-w-[640px] text-[32px] font-bold leading-[1.1] tracking-tight text-white sm:text-[44px]">
              Teste com o seu pet shop por {MARCA.diasTeste} dias.
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[17px] text-white/85">Sem cartão. Seus serviços e mensagens já vêm prontos, é só ajustar.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <BotaoCta href={CRIAR} variante="claro">
                Criar minha conta grátis
              </BotaoCta>
              <BotaoCta href={DEMO} variante="vidro">
                Ver demonstração
              </BotaoCta>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Rodape({ suporte }: { suporte: string | null }) {
  const colunas: [string, [string, string][]][] = [
    [
      "Produto",
      [
        ["#recursos", "Recursos"],
        ["#agendamento", "Agendamento online"],
        ["#preco", "Preço"],
        ["#perguntas", "Dúvidas"],
      ],
    ],
    [
      "Conta",
      [
        ["/entrar", "Entrar"],
        [CRIAR, "Testar grátis"],
        [DEMO, "Ver demonstração"],
      ],
    ],
    [
      "Legal",
      [
        ["/termos", "Termos de uso"],
        ["/privacidade", "Privacidade"],
      ],
    ],
  ];
  return (
    <footer className="border-t border-line bg-white py-12">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-muted">Sistema para banho e tosa com a tutora acompanhando cada etapa.</p>
            {suporte && (
              <a href={suporte} className="mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-brand-700">
                <MessageCircle className="h-4 w-4" /> Falar com a gente
              </a>
            )}
          </div>
          {colunas.map(([titulo, links]) => (
            <nav key={titulo} aria-label={titulo}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-subtle">{titulo}</p>
              <ul className="mt-3 space-y-2 text-[14.5px]">
                {links.map(([href, texto]) => (
                  <li key={href}>
                    <a href={href} className="text-muted hover:text-brand-700">
                      {texto}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-10 border-t border-line pt-6 text-[13px] text-subtle">
          © 2026 {MARCA.nome}
          {MARCA.empresa.razaoSocial ? ` · ${MARCA.empresa.razaoSocial}` : ""}
          {MARCA.empresa.documento ? ` · CNPJ ${MARCA.empresa.documento}` : ""}
        </p>
      </Container>
    </footer>
  );
}

/** Botão flutuante de WhatsApp (só aparece quando há número de suporte em src/lib/marca.ts). */
function BotaoWhatsapp({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="Falar com a gente no WhatsApp"
      className="tap fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_28px_-8px_rgb(0_0_0/0.35)]"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
