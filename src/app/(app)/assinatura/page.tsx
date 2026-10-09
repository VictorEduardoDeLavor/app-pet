"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, ExternalLink, LifeBuoy, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "@/data/store";
import { ErroCobranca, assinar, cancelarAssinatura, sincronizarAssinatura, useAssinatura } from "@/data/assinatura";
import {
  NOME_FORMA,
  NOME_STATUS_PAGAMENTO,
  PAGAS,
  diaMes,
  faturaEmAberto,
  formatarDocumento,
  situacao,
  type InfoAssinatura,
} from "@/domain/assinatura";
import { supabase } from "@/lib/supabase/client";
import { MARCA, linkSuporte } from "@/lib/marca";
import { Aviso, Botao, BotaoExterno, Campo, Chip, Folha, Progresso, Secao, Titulo, cx } from "@/components/ui";
import { useSessao, useToast } from "@/components/providers";

const INCLUI = [
  "Agenda, fila do banhista e equipe sem limite de pessoas",
  "Tutora acompanha cada etapa com fotos pelo WhatsApp",
  "Leva e traz com o carro no mapa em tempo real",
  "Pacotes, financeiro, caixa e comissões",
  "Mensagens prontas para o WhatsApp",
  "Sem fidelidade: cancele quando quiser",
];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Assinatura() {
  const info = useAssinatura((s) => s.info);
  const recarregar = useAssinatura((s) => s.recarregar);
  const petshopId = useApp((s) => s.petshopId);
  const modo = useApp((s) => s.modo);
  const nomePetshop = useApp((s) => s.db.petshop.nome);
  const toast = useToast();
  const [atualizando, setAtualizando] = useState(false);
  const sincronizou = useRef(false);
  const nuvem = modo === "nuvem" && !!petshopId;

  async function atualizar(silencioso = false) {
    if (!nuvem || !info?.assinada) return;
    setAtualizando(true);
    try {
      await sincronizarAssinatura(supabase(), petshopId!);
      await recarregar(supabase(), petshopId!);
      if (!silencioso) toast("Faturas atualizadas.");
    } catch (e) {
      if (!silencioso) toast(e instanceof Error ? e.message : "Não foi possível atualizar.", "erro");
    } finally {
      setAtualizando(false);
    }
  }

  // Ao abrir, confere no Asaas se alguma fatura foi paga (caso o aviso automático atrase).
  useEffect(() => {
    if (sincronizou.current || !info?.assinada || !nuvem) return;
    sincronizou.current = true;
    void atualizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.assinada, nuvem]);

  if (!info) return null;
  if (!info.dono) {
    return (
      <div>
        <Titulo>Assinatura</Titulo>
        <p className="px-5 text-[15px] text-muted">Só o dono do pet shop vê e cuida da assinatura.</p>
      </div>
    );
  }

  const s = situacao(info);
  const aberta = faturaEmAberto(info);
  const podeAssinar = !info.assinada;
  const tom = s.tom === "ok" ? "ok" : s.tom === "erro" ? "bad" : s.tom === "aviso" ? "warn" : "info";

  return (
    <div>
      <Titulo
        acao={
          info.assinada && nuvem ? (
            <button onClick={() => atualizar()} disabled={atualizando} aria-label="Atualizar faturas" className="tap grid h-11 w-11 place-items-center rounded-full hover:bg-surface">
              <RefreshCw className={cx("h-5 w-5 text-muted", atualizando && "animate-spin")} />
            </button>
          ) : undefined
        }
      >
        Assinatura
      </Titulo>

      <div className="space-y-4 px-5">
        <Aviso tom={tom} icone={tom === "ok" ? <ShieldCheck className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />} titulo={s.titulo} texto={s.texto} />
        {s.fase === "teste" && s.diasTeste !== undefined && (
          <div>
            <Progresso valor={Math.max(0, MARCA.diasTeste - s.diasTeste)} total={MARCA.diasTeste} />
            <p className="mt-1.5 text-[12.5px] text-muted">
              {MARCA.diasTeste - s.diasTeste} de {MARCA.diasTeste} dias de teste usados
            </p>
          </div>
        )}
        {aberta?.link && (
          <BotaoExterno href={aberta.link} icone={<CreditCard className="h-5 w-5" />}>
            Pagar fatura de {diaMes(aberta.vencimento)} · {moeda(aberta.valor)}
          </BotaoExterno>
        )}
      </div>

      <Secao titulo="Seu plano" className="mt-6">
        <div className="card overflow-hidden">
          <div className="flex items-end justify-between bg-gradient-to-br from-brand-600 to-brand-800 px-5 pb-4 pt-5 text-white">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">{MARCA.nome} completo</p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
                {moeda(info.valor)}
                <span className="text-[15px] font-medium text-white/75">/mês</span>
              </p>
            </div>
            <Sparkles className="h-8 w-8 text-white/70" />
          </div>
          <ul className="space-y-2.5 px-5 py-4">
            {INCLUI.map((t) => (
              <li key={t} className="flex gap-2.5 text-[14px]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok-500" strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Secao>

      {info.demo ? (
        <div className="mx-5 mt-6">
          <Aviso tom="info" icone={<Sparkles className="h-5 w-5" />} titulo="Na demonstração nada é cobrado" texto={`Crie sua conta para começar os ${MARCA.diasTeste} dias grátis com os dados do seu pet shop.`} />
        </div>
      ) : (
        podeAssinar && <FormAssinar info={info} nomePetshop={nomePetshop} />
      )}

      {info.assinada && <Faturas info={info} />}
      {info.assinada && info.status !== "cancelada" && nuvem && <Cancelar usaAte={s.usaAte} />}
    </div>
  );
}

function FormAssinar({ info, nomePetshop }: { info: InfoAssinatura; nomePetshop: string }) {
  const petshopId = useApp((s) => s.petshopId);
  const recarregar = useAssinatura((s) => s.recarregar);
  const { email } = useSessao();
  const toast = useToast();
  const [doc, setDoc] = useState(info.documento ? formatarDocumento(info.documento) : "");
  const [mail, setMail] = useState(info.emailCobranca ?? email ?? "");
  const [nome, setNome] = useState(nomePetshop);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ msg: string; semGateway: boolean } | null>(null);
  const emTeste = !!info.testeAte && new Date(info.testeAte) > new Date();
  const suporte = linkSuporte(`Olá! Quero assinar o ${MARCA.nome} para o ${nomePetshop}.`);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!petshopId) return;
    setErro(null);
    setEnviando(true);
    try {
      const r = await assinar(supabase(), petshopId, { documento: doc, email: mail, nome });
      await recarregar(supabase(), petshopId);
      toast(emTeste ? "Assinatura feita! Nada é cobrado antes do fim do teste." : "Assinatura feita! Pague a fatura para liberar o acesso.");
      if (r.link && !emTeste) window.open(r.link, "_blank", "noopener");
    } catch (err) {
      setErro({ msg: err instanceof Error ? err.message : String(err), semGateway: err instanceof ErroCobranca && err.codigo === "sem_gateway" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Secao titulo="Assinar" className="mt-6">
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="CPF ou CNPJ de quem paga" dica="Vai na fatura e na nota. Pode ser o CPF do dono, se o pet shop não tiver CNPJ.">
          <input className="input" inputMode="numeric" required value={doc} onChange={(e) => setDoc(e.target.value)} onBlur={() => setDoc(formatarDocumento(doc))} placeholder="000.000.000-00" />
        </Campo>
        <Campo rotulo="Nome na fatura">
          <input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="E-mail para receber as faturas">
          <input className="input" type="email" required value={mail} onChange={(e) => setMail(e.target.value)} autoComplete="email" />
        </Campo>
        {erro && (
          <Aviso
            tom="bad"
            icone={<LifeBuoy className="h-5 w-5" />}
            titulo={erro.msg}
            texto={erro.semGateway && suporte ? <a className="font-semibold text-brand-700 underline" href={suporte} target="_blank" rel="noreferrer">Falar com o suporte</a> : undefined}
          />
        )}
        <Botao type="submit" disabled={enviando} icone={<CreditCard className="h-5 w-5" />}>
          {enviando ? "Aguarde…" : `Assinar por ${moeda(info.valor)}/mês`}
        </Botao>
        <p className="text-center text-[12.5px] text-muted">
          {emTeste
            ? `A primeira mensalidade vence em ${diaMes(info.testeAte!)}, quando o teste acaba. `
            : "A primeira mensalidade vence hoje. "}
          Você escolhe Pix, boleto ou cartão na fatura. Pagamentos processados pelo Asaas.
        </p>
      </form>
    </Secao>
  );
}

function Faturas({ info }: { info: InfoAssinatura }) {
  const lista = info.pagamentos ?? [];
  return (
    <Secao titulo="Faturas" className="mt-6">
      {lista.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted">A primeira fatura aparece aqui em instantes.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[20px] border border-line">
          {lista.map((p) => {
            const paga = PAGAS.includes(p.status);
            const emAberto = p.status === "PENDING" || p.status === "OVERDUE";
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">
                    {moeda(p.valor)} <span className="font-normal text-muted">· vence {diaMes(p.vencimento)}</span>
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {paga && p.pagoEm ? `Paga em ${diaMes(p.pagoEm)}` : NOME_FORMA[p.forma ?? "UNDEFINED"] ?? p.forma}
                    {paga && p.forma && p.forma !== "UNDEFINED" ? ` · ${NOME_FORMA[p.forma] ?? p.forma}` : ""}
                  </p>
                </div>
                <Chip tom={paga ? "ok" : p.status === "OVERDUE" ? "bad" : emAberto ? "warn" : "neutral"}>{NOME_STATUS_PAGAMENTO[p.status] ?? p.status}</Chip>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" aria-label={emAberto ? "Pagar" : "Ver recibo"} className="tap grid h-9 w-9 place-items-center rounded-full bg-surface text-brand-700">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {info.documento && (
        <p className="mt-3 text-[12.5px] text-muted">
          Cobrança em nome de {formatarDocumento(info.documento)}
          {info.emailCobranca ? ` · faturas para ${info.emailCobranca}` : ""}
        </p>
      )}
    </Secao>
  );
}

function Cancelar({ usaAte }: { usaAte?: string }) {
  const petshopId = useApp((s) => s.petshopId);
  const recarregar = useAssinatura((s) => s.recarregar);
  const toast = useToast();
  const [aberta, setAberta] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function cancelar() {
    if (!petshopId) return;
    setEnviando(true);
    try {
      await cancelarAssinatura(supabase(), petshopId);
      await recarregar(supabase(), petshopId);
      toast("Assinatura cancelada. Nada mais será cobrado.");
      setAberta(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível cancelar agora.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-5 mt-8">
      <button onClick={() => setAberta(true)} className="w-full py-3 text-center text-[14px] font-medium text-muted underline-offset-4 hover:underline">
        Cancelar assinatura
      </button>
      <Folha aberta={aberta} onFechar={() => setAberta(false)} titulo="Cancelar assinatura?">
        <div className="space-y-4 pb-2">
          <p className="text-[14.5px] text-muted">
            As faturas em aberto são canceladas e nada mais será cobrado.
            {usaAte ? ` Você continua usando até ${diaMes(usaAte)}.` : ""} Clientes, pets e histórico continuam guardados se quiser voltar.
          </p>
          <Botao variante="perigo" disabled={enviando} onClick={cancelar}>
            {enviando ? "Cancelando…" : "Sim, cancelar"}
          </Botao>
          <Botao variante="fantasma" onClick={() => setAberta(false)}>
            Manter assinatura
          </Botao>
        </div>
      </Folha>
    </div>
  );
}
