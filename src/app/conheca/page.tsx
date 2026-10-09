/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Calendar,
  Camera,
  Car,
  Check,
  ChevronDown,
  FileSpreadsheet,
  HandCoins,
  ListChecks,
  MapPin,
  MessageCircle,
  Package,
  PawPrint,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { MARCA } from "@/lib/marca";

const preco = `R$ ${MARCA.precoMensal}`;

export const metadata: Metadata = {
  title: `${MARCA.nome} · Gestão de banho e tosa com a tutora acompanhando cada etapa`,
  description: `Agenda, fila da equipe, pacotes, caixa e comissões. A tutora acompanha o banho com fotos e o leva e traz no mapa, por um link no WhatsApp. ${MARCA.diasTeste} dias grátis.`,
  openGraph: {
    title: `${MARCA.nome} · a tutora acompanha cada etapa do banho`,
    description: `Gestão de banho e tosa com fotos de cada etapa e leva e traz no mapa. ${MARCA.diasTeste} dias grátis, depois ${preco}/mês.`,
    images: [{ url: "/fotos/og-conheca.jpg", width: 1200, height: 630 }],
    locale: "pt_BR",
    type: "website",
  },
};

const CRIAR = "/entrar?criar=1";
const DEMO = "/entrar?demo=1";

export default function Conheca() {
  return (
    <div className="overflow-x-clip">
      <Topo />
      <Hero />
      <Faixa />
      <Tutora />
      <Recursos />
      <Equipe />
      <Passos />
      <Preco />
      <Perguntas />
      <Final />
      <Rodape />
    </div>
  );
}

// ---------------------------------------------------------------------------

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
    <a href={href} className={`tap inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl px-6 text-[15.5px] font-semibold ${estilo}`}>
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

// ---------------------------------------------------------------------------

function Topo() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="/conheca" aria-label={MARCA.nome}>
          <Logo />
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#recursos" className="hidden rounded-full px-3 py-2 text-[14.5px] font-medium text-muted hover:text-ink md:block">
            Recursos
          </a>
          <a href="#preco" className="hidden rounded-full px-3 py-2 text-[14.5px] font-medium text-muted hover:text-ink md:block">
            Preço
          </a>
          <a href="#perguntas" className="hidden rounded-full px-3 py-2 text-[14.5px] font-medium text-muted hover:text-ink md:block">
            Dúvidas
          </a>
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
            <Sparkles className="h-4 w-4" /> Para pet shops e banho e tosa
          </p>
          <h1 className="mt-5 text-[40px] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[54px]">
            Seu banho e tosa organizado. <span className="text-brand-600">A tutora acompanhando cada etapa.</span>
          </h1>
          <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-muted sm:text-[18.5px]">
            Agenda, fila da equipe, pacotes, caixa e comissões num lugar só. E um link no WhatsApp para a tutora ver as fotos do banho e o carro chegando no
            mapa.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <BotaoCta href={CRIAR}>Testar {MARCA.diasTeste} dias grátis</BotaoCta>
            <BotaoCta href={DEMO} variante="claro">
              Ver demonstração
            </BotaoCta>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-ok-500" strokeWidth={2.6} /> Sem cartão
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-ok-500" strokeWidth={2.6} /> {preco}/mês depois
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-ok-500" strokeWidth={2.6} /> Cancele quando quiser
            </span>
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
    { i: <Smartphone className="h-5 w-5" />, t: "Abre no celular e no computador, sem instalar" },
    { i: <Users className="h-5 w-5" />, t: "Equipe sem limite de pessoas" },
    { i: <ShieldCheck className="h-5 w-5" />, t: "Cada pet shop só vê os próprios dados" },
    { i: <BadgeCheck className="h-5 w-5" />, t: "Sem fidelidade e sem taxa de adesão" },
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

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-600">{children}</p>;
}

function Tutora() {
  const pontos = [
    { i: <MessageCircle className="h-5 w-5" />, t: "Um link privado por atendimento", d: "Enviado no WhatsApp com um toque. A tutora não baixa app nem cria senha." },
    { i: <Camera className="h-5 w-5" />, t: "Fotos de cada etapa", d: "Chegou, banho, secagem, tosa e pronto, com recadinhos da equipe." },
    { i: <MapPin className="h-5 w-5" />, t: "O carro no mapa, ao vivo", d: "No leva e traz, ela vê o motorista chegando para buscar e para entregar." },
  ];
  return (
    <section className="py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div className="order-2 mx-auto w-full max-w-[300px] lg:order-1">
          <Celular src="/fotos/app/tutor-mapa.webp" alt="Página da tutora com o carro do leva e traz no mapa" />
        </div>
        <div className="order-1 lg:order-2">
          <Rotulo>O diferencial</Rotulo>
          <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">
            Menos &quot;já está pronto?&quot; no WhatsApp. Mais tutora voltando.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Quem deixa o pet quer saber como ele está. Com o {MARCA.nome}, a tutora acompanha tudo sozinha e o seu atendimento vira assunto no grupo da família.
          </p>
          <ul className="mt-8 space-y-5">
            {pontos.map((p) => (
              <li key={p.t} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-[var(--shadow-float)]">{p.i}</span>
                <span>
                  <span className="block text-[16.5px] font-semibold">{p.t}</span>
                  <span className="block text-[15px] text-muted">{p.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function Recursos() {
  const lista = [
    { i: <Calendar />, t: "Agenda sem conflito", d: "Preço e duração por porte. O sistema não deixa marcar dois pets no mesmo horário para a mesma pessoa." },
    { i: <ListChecks />, t: "Fila do banhista", d: "Cada um vê os pets do dia, alergias em destaque, registra as etapas com foto e finaliza." },
    { i: <Camera />, t: "Acompanhamento com fotos", d: "Linha do tempo do banho no link da tutora, atualizando sozinha." },
    { i: <Car />, t: "Leva e traz com GPS", d: "Rotas do dia, rota no Google Maps, motorista no mapa e aviso para o tutor." },
    { i: <Package />, t: "Pacotes e planos", d: "Venda pacotes de banhos; cada atendimento desconta sozinho e avisa quando está acabando." },
    { i: <Wallet />, t: "Financeiro e caixa", d: "Receitas, despesas, pagamentos por Pix, cartão ou dinheiro e fechamento do dia." },
    { i: <HandCoins />, t: "Comissões", d: "Por serviço ou por pessoa, com extrato e pagamento lançado no caixa." },
    { i: <MessageCircle />, t: "Mensagens prontas", d: "Confirmação, lembrete, pet pronto, renovação e cliente sumido, direto no WhatsApp." },
  ];
  return (
    <section id="recursos" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <Container>
        <div className="max-w-[640px]">
          <Rotulo>Tudo do dia a dia</Rotulo>
          <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">Do agendamento ao caixa, sem caderno e sem planilha.</h2>
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

function Equipe() {
  const papeis = [
    { t: "Dono", d: "Vê tudo: agenda, financeiro, comissões, equipe e assinatura." },
    { t: "Recepção", d: "Agenda, clientes, pacotes, mensagens e caixa." },
    { t: "Banhista e tosador", d: "Só a própria fila e as fotos, sem ver valores." },
    { t: "Motorista", d: "Só as rotas do leva e traz, com endereço e telefone." },
  ];
  return (
    <section className="py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Rotulo>Cada um no seu lugar</Rotulo>
          <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">A equipe toda no mesmo app, cada um vendo o que precisa.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Convide por um código de 6 letras. Cada pessoa entra com o próprio e-mail e o acesso segue a função dela.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {papeis.map((p) => (
              <li key={p.t} className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-line">
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
    { n: "3", t: "Mande o primeiro link", d: "Convide a equipe e envie para uma tutora acompanhar o banho de hoje." },
  ];
  return (
    <section className="bg-white py-20 lg:py-24">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-[560px]">
            <Rotulo>Comece hoje</Rotulo>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">Pronto para usar em poucos minutos.</h2>
          </div>
          <p className="flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-[14px] font-medium text-brand-700">
            <FileSpreadsheet className="h-4 w-4" /> Modelo de planilha incluso
          </p>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {passos.map((p) => (
            <li key={p.n} className="relative rounded-[24px] bg-surface p-6">
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
    "Equipe e clientes sem limite",
    "Acompanhamento com fotos e leva e traz com GPS",
    "Importação de clientes por planilha",
    "Atualizações sem custo extra",
    "Pague por Pix, boleto ou cartão",
  ];
  return (
    <section id="preco" className="scroll-mt-20 py-20 lg:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Rotulo>Preço</Rotulo>
          <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">Um plano, tudo incluso.</h2>
          <p className="mt-4 max-w-[480px] text-[17px] leading-relaxed text-muted">
            Teste {MARCA.diasTeste} dias com tudo liberado e sem cartão. Se gostar, assine pelo próprio app. Se não, é só não assinar.
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-hero)] ring-1 ring-brand-100">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-7 pb-7 pt-7 text-white">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70">{MARCA.nome} completo</p>
            <p className="mt-2 text-[52px] font-bold leading-none tracking-tight">
              {preco}
              <span className="text-[18px] font-medium text-white/75">/mês</span>
            </p>
            <p className="mt-2 text-[14.5px] text-white/80">{MARCA.diasTeste} dias grátis · sem fidelidade</p>
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
    ["Preciso instalar alguma coisa?", "Não. Abre no navegador do celular ou do computador. No celular, dá para adicionar à tela inicial e usar como um app."],
    ["A tutora precisa baixar app ou criar senha?", "Não. Ela recebe um link no WhatsApp e acompanha por ali, com fotos e, no leva e traz, o carro no mapa."],
    ["Como funciona o teste grátis?", `São ${MARCA.diasTeste} dias com tudo liberado, sem cartão. Para continuar depois, assine na tela Assinatura do app.`],
    ["Como eu pago a mensalidade?", `${preco} por mês, por Pix, boleto ou cartão. Sem fidelidade e sem multa: cancele quando quiser pelo próprio app.`],
    ["Já tenho meus clientes numa planilha. E agora?", "É só importar: planilha do Excel ou CSV, inclusive exportada de outro sistema. Quem já está cadastrado não é duplicado."],
    ["Como funciona o GPS do motorista?", "Pelo celular do motorista: ele toca em “Saí para buscar” e o app manda a posição enquanto estiver aberto na tela; ao chegar, desliga sozinho."],
    ["Tem limite de clientes, pets ou equipe?", "Não. O preço é o mesmo para qualquer tamanho de pet shop."],
    ["Meus dados ficam seguros?", "Cada pet shop só enxerga os próprios dados, com regras aplicadas no banco. Banhista e motorista não veem o financeiro. Os detalhes estão na política de privacidade."],
  ];
  return (
    <section id="perguntas" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Rotulo>Dúvidas</Rotulo>
          <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">Perguntas frequentes</h2>
        </div>
        <div className="divide-y divide-line rounded-[24px] border border-line">
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
    <section className="py-16 lg:py-24">
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

function Rodape() {
  return (
    <footer className="border-t border-line bg-white py-10">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-[13.5px] text-muted">{MARCA.slogan}.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-muted">
          <a href="/entrar" className="hover:text-brand-700">
            Entrar
          </a>
          <a href="/termos" className="hover:text-brand-700">
            Termos de uso
          </a>
          <a href="/privacidade" className="hover:text-brand-700">
            Privacidade
          </a>
          <span>© 2026 {MARCA.nome}</span>
        </nav>
      </Container>
    </footer>
  );
}
