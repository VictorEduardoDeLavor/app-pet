"use client";

// Peças do acompanhamento: foto pela câmera, folha para registrar etapa e a linha do tempo.
// A mesma linha do tempo aparece para a equipe (ficha do atendimento) e para o tutor (link).

import { useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  CalendarCheck,
  Camera,
  Car,
  Check,
  House,
  ImagePlus,
  PawPrint,
  Play,
  Scissors,
  ShowerHead,
  Sparkles,
  Store,
  UserX,
  Wind,
  X,
} from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Etapa } from "@/domain/types";
import { ETAPAS_BANHO, NOME_ETAPA, etapasDoAtendimento, porId } from "@/domain/rules";
import type { IconeLinha, ItemLinha } from "@/domain/linha-tempo";
import { Botao, Campo, Folha, cx } from "./ui";
import { useToast } from "./providers";

// ---------------------------------------------------------------------------
// Ícones
// ---------------------------------------------------------------------------

const ICONES: Record<IconeLinha, typeof Check> = {
  saiu_para_buscar: Car,
  pet_buscado: PawPrint,
  chegou: Store,
  banho: ShowerHead,
  secagem: Wind,
  tosa: Scissors,
  pronto: Sparkles,
  saiu_para_entregar: Car,
  entregue: House,
  agendado: CalendarCheck,
  confirmado: CalendarCheck,
  em_atendimento: Play,
  finalizado: Check,
  cancelado: Ban,
  faltou: UserX,
};

export function IconeEtapa({ icone, className }: { icone: IconeLinha; className?: string }) {
  const I = ICONES[icone];
  return <I className={className} />;
}

// ---------------------------------------------------------------------------
// Foto pela câmera do celular
// ---------------------------------------------------------------------------

/** Botão que abre a câmera (no celular) ou a galeria (no computador) e mostra a prévia. */
export function FotoBotao({ foto, onFoto, rotulo = "Tirar foto", className }: { foto: File | null; onFoto: (f: File | null) => void; rotulo?: string; className?: string }) {
  const [previa, setPrevia] = useState<string | null>(null);
  useEffect(() => {
    if (!foto) return setPrevia(null);
    const url = URL.createObjectURL(foto);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  if (previa) {
    return (
      <div className={cx("relative overflow-hidden rounded-2xl border border-line", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previa} alt="Prévia da foto" className="h-48 w-full object-cover" />
        <button
          type="button"
          aria-label="Tirar a foto"
          onClick={() => onFoto(null)}
          className="tap absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-ink/60 text-white backdrop-blur"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <label
      className={cx(
        "tap flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-brand-300 bg-brand-50/60 text-brand-700",
        className,
      )}
    >
      <Camera className="h-6 w-6" />
      <span className="text-[14px] font-semibold">{rotulo}</span>
      <span className="text-[12px] text-muted">Opcional · o tutor vê pelo link</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onFoto(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Registrar etapa do banho
// ---------------------------------------------------------------------------

export function EtapaFolha({ atendimentoId, aberta, onFechar, sugerida }: { atendimentoId: string; aberta: boolean; onFechar: () => void; sugerida?: Etapa }) {
  const db = useDb();
  const registrar = useApp((s) => s.registrarEtapa);
  const toast = useToast();
  const atd = porId(db.atendimentos, atendimentoId);
  const pet = atd ? porId(db.pets, atd.petId) : undefined;
  const feitas = new Set(etapasDoAtendimento(db, atendimentoId).map((e) => e.etapa));
  const proxima = sugerida ?? ETAPAS_BANHO.find((e) => !feitas.has(e)) ?? "pronto";
  const [etapa, setEtapa] = useState<Etapa>(proxima);
  const [foto, setFoto] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    setEtapa(proxima);
    setFoto(null);
    setNota("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  if (!atd || !pet) return null;

  async function salvar() {
    setEnviando(true);
    const r = await registrar({ atendimentoId, etapa, nota, foto });
    setEnviando(false);
    if (!r.ok) return toast(r.erro, "erro");
    toast(foto ? `${NOME_ETAPA[etapa]} com foto · o tutor já pode ver` : `${NOME_ETAPA[etapa]} registrado`);
    onFechar();
  }

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={`Etapa de ${pet.nome}`}>
      <div className="grid grid-cols-3 gap-2">
        {ETAPAS_BANHO.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEtapa(e)}
            className={cx(
              "tap relative flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[12.5px] font-medium",
              etapa === e ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink/80",
            )}
          >
            <IconeEtapa icone={e} className="h-5 w-5" />
            {NOME_ETAPA[e]}
            {feitas.has(e) && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-ok-500" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <FotoBotao className="mt-4" foto={foto} onFoto={setFoto} rotulo={etapa === "pronto" ? "Foto do resultado" : "Tirar foto"} />
      <div className="mt-4">
        <Campo rotulo="Recado para o tutor (opcional)">
          <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={`Ex.: ${pet.nome} se comportou super bem!`} maxLength={140} />
        </Campo>
      </div>
      <Botao className="mt-5" onClick={salvar} disabled={enviando} icone={foto ? <ImagePlus className="h-5 w-5" /> : <Check className="h-5 w-5" />}>
        {enviando ? (foto ? "Enviando a foto…" : "Salvando…") : `Registrar “${NOME_ETAPA[etapa]}”`}
      </Botao>
    </Folha>
  );
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

/** "10:08" no dia de hoje; "05/10 · 10:00" em outro dia (ex.: quando o horário foi marcado). */
function hora(iso: string, fuso?: string) {
  const d = new Date(iso);
  const h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso });
  const dia = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: fuso });
  return dia(d) === dia(new Date()) ? h : `${dia(d)} · ${h}`;
}

export function LinhaDoTempo({ itens, paraTutor = false, fuso, vazio }: { itens: ItemLinha[]; paraTutor?: boolean; fuso?: string; vazio?: ReactNode }) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (itens.length === 0) return <>{vazio ?? null}</>;
  const ordem = paraTutor ? [...itens].reverse() : itens;
  return (
    <>
      <ol className="relative space-y-4">
        {ordem.map((it, i) => {
          const atual = paraTutor ? i === 0 : i === ordem.length - 1;
          return (
            <li key={it.id} className="relative flex gap-3">
              {/* trilho */}
              {i < ordem.length - 1 && <span aria-hidden className="absolute left-[17px] top-9 h-[calc(100%-12px)] w-[2px] rounded bg-brand-100" />}
              <span
                className={cx(
                  "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full",
                  atual ? "bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgb(106_79_227/0.7)]" : "bg-brand-50 text-brand-600",
                )}
              >
                <IconeEtapa icone={it.icone} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1 pt-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cx("text-[14.5px] leading-snug", atual ? "font-semibold text-ink" : "font-medium text-ink/85")}>{paraTutor ? it.frase : it.titulo}</p>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted">{hora(it.em, fuso)}</span>
                </div>
                {it.nota && <p className="mt-0.5 text-[13.5px] text-muted">“{it.nota}”</p>}
                {it.fotoUrl && (
                  <button type="button" onClick={() => setZoom(it.fotoUrl!)} className="tap mt-2 block w-full overflow-hidden rounded-2xl shadow-[var(--shadow-card)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.fotoUrl} alt={it.frase} loading="lazy" className={cx("w-full object-cover", paraTutor ? "max-h-80" : "max-h-56")} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {zoom && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-ink/90 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
          <button aria-label="Fechar" className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}
