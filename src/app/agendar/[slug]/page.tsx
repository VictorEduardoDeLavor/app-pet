"use client";

// Página pública do pet shop: o tutor escolhe serviços, dia e horário e agenda sozinho, sem login.
// Com sinal ligado, recebe o Pix copia e cola; a equipe confere e confirma pelo app.

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Cat, Check, Clock, Copy, Dog, MapPin, MessageCircle, PawPrint, QrCode, RefreshCw, SearchX } from "lucide-react";
import QRCode from "qrcode";
import { useApp } from "@/data/store";
import { agendarNaNuvem, buscarAgenda } from "@/data/agendamento-online";
import { supabase, temSupabase } from "@/lib/supabase/client";
import { agendaDoDb, diasDoCalendario, horariosOnline, resumoDoPedido, validarPedido, type AgendaPublica, type Confirmacao } from "@/domain/agendamento-online";
import { brCode } from "@/domain/pix";
import { ErroRegra } from "@/domain/rules";
import type { Porte } from "@/domain/types";
import { dataLonga, diaCurto, duracao, hoje, moeda, primeiroNome, telefone } from "@/domain/format";
import { linkWhatsapp } from "@/domain/messages";
import { Chip, cx } from "@/components/ui";
import { MARCA } from "@/lib/marca";

type Estado = { tipo: "carregando" } | { tipo: "nao-encontrado" } | { tipo: "erro"; msg: string } | { tipo: "ok"; agenda: AgendaPublica; demo: boolean };

const PORTES: { v: Porte; rotulo: string; dica: string }[] = [
  { v: "P", rotulo: "Pequeno", dica: "até 10 kg" },
  { v: "M", rotulo: "Médio", dica: "10 a 25 kg" },
  { v: "G", rotulo: "Grande", dica: "25 a 40 kg" },
  { v: "GG", rotulo: "Gigante", dica: "mais de 40 kg" },
];

export default function AgendarPagina() {
  const { slug } = useParams<{ slug: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      let falha: string | null = null;
      if (temSupabase) {
        try {
          const agenda = await buscarAgenda(supabase(), slug.toLowerCase());
          if (agenda) return vivo && setEstado({ tipo: "ok", agenda, demo: false });
        } catch (e) {
          falha = e instanceof Error ? e.message : String(e);
        }
      }
      // Demonstração: o pet shop de exemplo deste navegador.
      const { db, modo } = useApp.getState();
      if (modo === "demo" && db.petshop.slug === slug.toLowerCase() && db.petshop.agendamentoOnline) {
        return vivo && setEstado({ tipo: "ok", agenda: agendaDoDb(db, hoje(), 60), demo: true });
      }
      if (vivo) setEstado(falha ? { tipo: "erro", msg: falha } : { tipo: "nao-encontrado" });
    })();
    return () => {
      vivo = false;
    };
  }, [slug, versao]);

  if (estado.tipo === "carregando")
    return (
      <div className="grid min-h-dvh place-items-center bg-white">
        <PawPrint className="h-9 w-9 animate-pulse text-brand-500" />
      </div>
    );
  if (estado.tipo !== "ok")
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center bg-white px-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-surface text-brand-600">
          <SearchX className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-[20px] font-bold">{estado.tipo === "erro" ? "Não deu para carregar agora" : "Agendamento online indisponível"}</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          {estado.tipo === "erro" ? "Verifique a internet e tente de novo." : "Confira o link ou fale com o pet shop pelo WhatsApp."}
        </p>
        {estado.tipo === "erro" && (
          <button onClick={() => setVersao((v) => v + 1)} className="tap mt-5 flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        )}
      </main>
    );
  return <Formulario slug={slug.toLowerCase()} agenda={estado.agenda} demo={estado.demo} recarregar={() => setVersao((v) => v + 1)} />;
}

function Formulario({ slug, agenda, demo, recarregar }: { slug: string; agenda: AgendaPublica; demo: boolean; recarregar: () => void }) {
  const agendarDemo = useApp((s) => s.agendarOnlineDemo);
  const T = hoje();
  const [especie, setEspecie] = useState<"cao" | "gato">("cao");
  const [porte, setPorte] = useState<Porte | null>(null);
  const [servicos, setServicos] = useState<string[]>([]);
  const dias = useMemo(() => diasDoCalendario(agenda, T, 14), [agenda, T]);
  const [data, setData] = useState<string>("");
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [pet, setPet] = useState("");
  const [raca, setRaca] = useState("");
  const [obs, setObs] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState<Confirmacao | null>(null);

  const resumo = porte ? resumoDoPedido(agenda, porte, servicos) : { total: 0, duracao: 0, sinal: 0 };
  const horarios = useMemo(() => (data && resumo.duracao > 0 ? horariosOnline(agenda, data, resumo.duracao) : []), [agenda, data, resumo.duracao]);
  const vagasPorDia = useMemo(
    () => (resumo.duracao > 0 ? Object.fromEntries(dias.map((d) => [d, horariosOnline(agenda, d, resumo.duracao).length])) : {}),
    [agenda, dias, resumo.duracao],
  );
  const ps = agenda.petshop;

  useEffect(() => {
    if (hora && !horarios.includes(hora)) setHora("");
  }, [horarios, hora]);

  if (ok) return <Confirmado c={ok} pet={pet} demo={demo} />;

  async function enviar() {
    setErro("");
    const pedido = { nome, whatsapp: zap, pet, especie, raca, porte: porte ?? "P", servicos, data, hora, observacoes: obs, aceite };
    try {
      if (!porte) throw new ErroRegra("Escolha o porte do pet.");
      validarPedido(pedido);
    } catch (e) {
      return setErro(e instanceof Error ? e.message : String(e));
    }
    setEnviando(true);
    try {
      if (demo) {
        const r = agendarDemo(pedido);
        if (!r.ok) throw new Error(r.erro);
        setOk(r.valor);
      } else {
        setOk(await agendarNaNuvem(supabase(), slug, pedido));
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
      if (/ocupado/.test(msg)) recarregar();
    } finally {
      setEnviando(false);
    }
  }

  const passo = (n: number, titulo: string, feito: boolean) => (
    <h2 className="mb-3 flex items-center gap-2.5 text-[17px] font-semibold">
      <span className={cx("grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold", feito ? "bg-ok-500 text-white" : "bg-brand-100 text-brand-700")}>
        {feito ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
      </span>
      {titulo}
    </h2>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-[520px] bg-white pb-40 sm:my-6 sm:min-h-0 sm:rounded-[32px] sm:pb-10 sm:shadow-[var(--shadow-hero)]">
      <header className="relative overflow-hidden rounded-b-[32px] sm:rounded-t-[32px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fotos/capa-banho.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(29_18_74/0.25),rgb(29_18_74/0.88))]" />
        <div className="relative px-5 pb-6 pt-[max(20px,env(safe-area-inset-top))] text-white">
          <div className="flex items-center justify-between">
            <span className="vidro flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand-600">
                <PawPrint className="h-4 w-4" strokeWidth={2.4} />
              </span>
              Agendamento online
            </span>
            {demo && <Chip tom="warn">Demonstração</Chip>}
          </div>
          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-tight">{ps.nome}</h1>
          {ps.endereco && (
            <p className="mt-1 flex items-start gap-1.5 text-[13.5px] text-white/85">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {ps.endereco}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-white/85">
            <Clock className="h-4 w-4" />
            {ps.abre} às {ps.fecha} · {ps.diasAbertos.length === 7 ? "todos os dias" : ps.diasAbertos.map((d) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d]).join(", ")}
          </p>
          {ps.whatsapp && (
            <a href={linkWhatsapp(ps.whatsapp, "Olá! Vim pela página de agendamento.")} target="_blank" rel="noreferrer" className="vidro tap mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold">
              <MessageCircle className="h-4 w-4" />
              Dúvidas? {telefone(ps.whatsapp)}
            </a>
          )}
        </div>
      </header>

      <div className="space-y-8 px-5 pt-6">
        <section>
          {passo(1, "Seu pet", !!porte)}
          <div className="grid grid-cols-2 gap-2">
            {(["cao", "gato"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEspecie(e)}
                className={cx("tap flex items-center justify-center gap-2 rounded-2xl border py-3 text-[15px] font-medium", especie === e ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
              >
                {e === "cao" ? <Dog className="h-5 w-5" /> : <Cat className="h-5 w-5" />}
                {e === "cao" ? "Cachorro" : "Gato"}
              </button>
            ))}
          </div>
          <p className="label mt-4">Porte</p>
          <div className="grid grid-cols-4 gap-2">
            {PORTES.map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => setPorte(p.v)}
                className={cx("tap rounded-2xl border px-1 py-2.5 text-center", porte === p.v ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line")}
              >
                <span className="block text-[14px] font-semibold">{p.rotulo}</span>
                <span className="block text-[11px] text-muted">{p.dica}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={cx(!porte && "pointer-events-none opacity-40")}>
          {passo(2, "Serviços", servicos.length > 0)}
          <ul className="space-y-2">
            {agenda.servicos.map((s) => {
              const preco = porte ? s.precos[porte] : undefined;
              const on = servicos.includes(s.id);
              if (porte && !preco) return null;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setServicos(on ? servicos.filter((x) => x !== s.id) : [...servicos, s.id])}
                    className={cx("tap flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left", on ? "border-brand-600 bg-brand-50" : "border-line")}
                  >
                    <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2", on ? "border-brand-600 bg-brand-600 text-white" : "border-line")}>{on && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{s.nome}</span>
                      {preco && <span className="block text-[12.5px] text-muted">{duracao(preco.duracao)}</span>}
                    </span>
                    {preco && <span className="text-[15px] font-semibold">{preco.preco > 0 ? moeda(preco.preco) : "Consultar"}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={cx(servicos.length === 0 && "pointer-events-none opacity-40")}>
          {passo(3, "Dia e horário", !!hora)}
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {dias.map((d) => {
              const vagas = vagasPorDia[d] ?? 0;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={servicos.length > 0 && vagas === 0}
                  onClick={() => {
                    setData(d);
                    setHora("");
                  }}
                  className={cx(
                    "tap w-[64px] shrink-0 rounded-2xl border py-2.5 text-center disabled:opacity-35",
                    data === d ? "border-brand-600 bg-brand-600 text-white" : "border-line",
                  )}
                >
                  <span className={cx("block text-[11.5px] font-medium uppercase", data === d ? "text-white/80" : "text-muted")}>{d === T ? "Hoje" : diaCurto(d)}</span>
                  <span className="block text-[19px] font-bold">{Number(d.slice(8))}</span>
                  <span className={cx("block text-[10.5px]", data === d ? "text-white/80" : "text-subtle")}>{servicos.length ? (vagas ? `${vagas} vagas` : "lotado") : ""}</span>
                </button>
              );
            })}
          </div>
          {data && (
            <>
              <p className="mb-2 mt-4 text-[13.5px] font-medium text-muted">{dataLonga(data)}</p>
              {horarios.length === 0 ? (
                <p className="rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted">Sem horários livres neste dia. Escolha outro.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {horarios.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHora(h)}
                      className={cx("tap rounded-xl border py-2.5 text-[14.5px] font-semibold tabular-nums", hora === h ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink/85")}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className={cx(!hora && "pointer-events-none opacity-40")}>
          {passo(4, "Seus dados", false)}
          <div className="space-y-3">
            <input className="input" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
            <input className="input" placeholder="Seu WhatsApp com DDD" inputMode="tel" value={zap} onChange={(e) => setZap(e.target.value)} autoComplete="tel" />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Nome do pet" value={pet} onChange={(e) => setPet(e.target.value)} />
              <input className="input" placeholder="Raça (opcional)" value={raca} onChange={(e) => setRaca(e.target.value)} />
            </div>
            <textarea className="input resize-none" rows={2} placeholder="Algo que devemos saber? (alergia, medo de secador…)" value={obs} onChange={(e) => setObs(e.target.value)} />
            <label className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-[13.5px]">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
              <span>
                Autorizo o {ps.nome} a falar comigo pelo WhatsApp sobre este agendamento e os cuidados do meu pet.{" "}
                <a href="/privacidade" target="_blank" className="font-medium text-brand-700 underline underline-offset-2">
                  Privacidade
                </a>
              </span>
            </label>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] border-t border-line bg-white/95 px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent">
        {erro && <p className="mb-2 rounded-xl bg-bad-50 px-3 py-2 text-[13.5px] font-medium text-bad-700">{erro}</p>}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-muted">{hora ? `${dataLonga(data).split(",")[0]}, ${hora} · ${duracao(resumo.duracao)}` : servicos.length ? `${servicos.length} ${servicos.length === 1 ? "serviço" : "serviços"}` : "Escolha os serviços"}</p>
            <p className="text-[20px] font-bold tracking-tight">{moeda(resumo.total)}</p>
            {resumo.sinal > 0 && <p className="text-[12px] text-brand-700">Sinal de {moeda(resumo.sinal)} por Pix</p>}
          </div>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !hora}
            className="tap botao-primario h-[52px] shrink-0 rounded-2xl px-6 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {enviando ? "Agendando…" : "Agendar"}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-subtle">Feito com {MARCA.nome}</p>
      </div>
    </main>
  );
}

function Confirmado({ c, pet, demo }: { c: Confirmacao; pet: string; demo: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const codigo = useMemo(() => {
    if (!c.sinal || !c.pixChave) return null;
    try {
      return brCode({ chave: c.pixChave, nome: c.petshop, cidade: c.pixCidade || "BRASIL", valor: c.sinal, txid: `AG${c.token.slice(0, 20)}` });
    } catch {
      return null;
    }
  }, [c]);
  useEffect(() => {
    if (codigo) QRCode.toDataURL(codigo, { margin: 1, width: 240, color: { dark: "#1d1a2b" } }).then(setQr).catch(() => setQr(null));
  }, [codigo]);
  const nomePet = primeiroNome(pet.trim()) || "seu pet";
  const textoZap = `Olá! Agendei ${nomePet} pela página para ${dataLonga(c.data).toLowerCase()} às ${c.hora}.${c.sinal > 0 ? ` Paguei o sinal de ${moeda(c.sinal)} por Pix.` : ""}`;

  return (
    <main className="mx-auto min-h-dvh max-w-[520px] bg-white px-5 pb-12 pt-[max(28px,env(safe-area-inset-top))] sm:my-6 sm:min-h-0 sm:rounded-[32px] sm:shadow-[var(--shadow-hero)]">
      {demo && <Chip tom="warn">Demonstração: o pedido entrou na agenda deste navegador</Chip>}
      <span className="mt-4 grid h-16 w-16 place-items-center rounded-full bg-ok-500 text-white shadow-[0_10px_24px_-8px_rgb(47_138_87/0.6)]">
        <Check className="h-8 w-8" strokeWidth={3} />
      </span>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">Pedido enviado!</h1>
      <p className="mt-1 text-[15px] text-muted">
        {nomePet} está agendado na {c.petshop} para <strong className="text-ink">{dataLonga(c.data).toLowerCase()}, às {c.hora}</strong>. O pet shop confirma pelo WhatsApp.
      </p>
      <div className="mt-4 rounded-2xl bg-surface px-4 py-3 text-[14.5px]">
        <p className="flex justify-between">
          <span className="text-muted">Valor estimado</span>
          <strong>{moeda(c.total)}</strong>
        </p>
        {c.sinal > 0 && (
          <p className="mt-1 flex justify-between">
            <span className="text-muted">Sinal agora</span>
            <strong className="text-brand-700">{moeda(c.sinal)}</strong>
          </p>
        )}
      </div>

      {codigo && (
        <section className="mt-6 rounded-[22px] border border-brand-200 px-4 py-4">
          <h2 className="flex items-center gap-2 text-[16.5px] font-semibold">
            <QrCode className="h-5 w-5 text-brand-600" />
            Pague o sinal por Pix
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">Copie o código e cole no app do seu banco, em “Pix copia e cola”. O valor já vem preenchido.</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code do Pix" width={200} height={200} className="mx-auto mt-3 hidden rounded-xl sm:block" />
          )}
          <p className="mt-3 break-all rounded-xl bg-surface px-3 py-2.5 font-mono text-[11.5px] leading-snug text-ink/80">{codigo}</p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codigo);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                setCopiado(false);
              }
            }}
            className="tap botao-primario mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white"
          >
            {copiado ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            {copiado ? "Código copiado!" : "Copiar código Pix"}
          </button>
        </section>
      )}

      <div className="mt-5 space-y-3">
        {c.whatsapp && (
          <a href={linkWhatsapp(c.whatsapp, textoZap)} target="_blank" rel="noreferrer" className="tap flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-ok-500 text-[15px] font-semibold text-white">
            <MessageCircle className="h-5 w-5" />
            {c.sinal > 0 ? "Já paguei: avisar no WhatsApp" : "Falar com o pet shop"}
          </a>
        )}
        <a href={`/acompanhar/${c.token}`} className="tap flex h-[52px] w-full items-center justify-center rounded-2xl border-[1.5px] border-brand-300 text-[15px] font-semibold text-brand-700">
          Acompanhar o agendamento
        </a>
        <p className="text-center text-[12.5px] text-muted">Guarde este link: no dia, é por ele que você vê as fotos do banho.</p>
      </div>
    </main>
  );
}
