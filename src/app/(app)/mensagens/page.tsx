"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Pencil, RotateCcw, Send } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { GatilhoMensagem, MensagemModelo, Pet, Tutor } from "@/domain/types";
import { VARIAVEIS, modeloPorGatilho } from "@/domain/messages";
import { atendimentosDoDia, clientesSumidos, planosAVencer, porId, saldoPlano } from "@/domain/rules";
import { dataDoIso, hoje, somaDias } from "@/domain/format";
import { Botao, Chip, Folha, PetAvatar, Secao, Titulo, Vazio, cx } from "@/components/ui";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { useToast } from "@/components/providers";

interface Sugestao {
  chave: string;
  gatilho: GatilhoMensagem;
  tutor: Tutor;
  pet: Pet;
  atendimentoId?: string;
  contexto: string;
  enviado: boolean;
}

const GRUPOS: { gatilho: GatilhoMensagem; titulo: string }[] = [
  { gatilho: "pet_pronto", titulo: "Pet pronto" },
  { gatilho: "confirmacao", titulo: "Confirmar horário" },
  { gatilho: "lembrete", titulo: "Lembrete de amanhã" },
  { gatilho: "feedback", titulo: "Feedback de ontem" },
  { gatilho: "renovacao_plano", titulo: "Renovar plano" },
  { gatilho: "cliente_sumido", titulo: "Clientes sumidos" },
];

export default function Mensagens() {
  const db = useDb();
  const restaurar = useApp((s) => s.restaurarModelos);
  const toast = useToast();
  const T = hoje();
  const [zap, setZap] = useState<Sugestao | null>(null);
  const [editando, setEditando] = useState<MensagemModelo | null>(null);

  const sugestoes = useMemo(() => {
    const enviadoHoje = (gatilho: GatilhoMensagem, tutorId: string, atendimentoId?: string) => {
      const modelo = modeloPorGatilho(db, gatilho);
      return db.mensagensEnvios.some(
        (e) => e.modeloId === modelo?.id && e.tutorId === tutorId && (atendimentoId ? e.atendimentoId === atendimentoId : true) && dataDoIso(e.enviadoEm) === T,
      );
    };
    const lista: Sugestao[] = [];
    const add = (gatilho: GatilhoMensagem, tutorId: string, petId: string, contexto: string, atendimentoId?: string) => {
      const tutor = porId(db.tutores, tutorId);
      const pet = porId(db.pets, petId);
      if (!tutor || !pet || !tutor.consentimentoWhatsapp) return;
      lista.push({ chave: `${gatilho}-${atendimentoId ?? petId}`, gatilho, tutor, pet, atendimentoId, contexto, enviado: enviadoHoje(gatilho, tutorId, atendimentoId) });
    };
    for (const a of atendimentosDoDia(db, T)) {
      if (a.status === "finalizado") add("pet_pronto", a.tutorId, a.petId, `Finalizado · ${a.hora}`, a.id);
      if (a.status === "agendado") add("confirmacao", a.tutorId, a.petId, `Hoje às ${a.hora}`, a.id);
    }
    for (const a of atendimentosDoDia(db, somaDias(T, 1))) {
      if (a.status === "agendado") add("confirmacao", a.tutorId, a.petId, `Amanhã às ${a.hora}`, a.id);
      // Quem ainda não confirmou recebe a confirmação; quem já confirmou recebe o lembrete.
      if (a.status === "confirmado") add("lembrete", a.tutorId, a.petId, `Amanhã às ${a.hora}`, a.id);
    }
    for (const a of atendimentosDoDia(db, somaDias(T, -1))) {
      if (a.status === "finalizado") add("feedback", a.tutorId, a.petId, `Atendido ontem às ${a.hora}`, a.id);
    }
    for (const p of planosAVencer(db, T)) add("renovacao_plano", p.tutorId, p.petId, `${saldoPlano(db, p.id)} de ${p.totalUsos} restantes`);
    for (const c of clientesSumidos(db, T)) add("cliente_sumido", c.tutor.id, c.pets[0].id, `${c.dias} dias sem visita`);
    return lista;
  }, [db, T]);

  const pendentes = sugestoes.filter((s) => !s.enviado).length;

  return (
    <div>
      <Titulo>Mensagens</Titulo>
      <p className="-mt-2 px-5 text-[14px] text-muted">
        {pendentes > 0 ? `${pendentes} mensagens sugeridas para hoje.` : "Nenhuma mensagem pendente hoje."} O texto já vem com os dados do atendimento.
      </p>

      {sugestoes.length === 0 ? (
        <Vazio icone={<Send className="h-6 w-6" />} titulo="Nada para enviar agora" />
      ) : (
        <div className="mt-5 space-y-5">
          {GRUPOS.map(({ gatilho, titulo }) => {
            const itens = sugestoes.filter((s) => s.gatilho === gatilho);
            if (itens.length === 0) return null;
            return (
              <Secao key={gatilho} titulo={titulo} acao={<span className="text-[13px] text-muted">{itens.filter((i) => !i.enviado).length} pendentes</span>}>
                <div id={gatilho === "cliente_sumido" ? "sumidos" : undefined} className="scroll-mt-4" />
                <ul className="card divide-y divide-line">
                  {itens.map((s) => (
                    <li key={s.chave} className="flex items-center gap-3 px-3.5 py-3">
                      <PetAvatar pet={s.pet} tamanho={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">
                          {s.pet.nome} <span className="font-normal text-muted">· {s.tutor.nome.split(" ")[0]}</span>
                        </p>
                        <p className="truncate text-[12.5px] text-muted">{s.contexto}</p>
                      </div>
                      {s.enviado ? (
                        <Chip tom="ok">
                          <Check className="mr-1 h-3 w-3" />
                          Enviada
                        </Chip>
                      ) : (
                        <button onClick={() => setZap(s)} className="tap flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-[13.5px] font-semibold text-white">
                          <Send className="h-3.5 w-3.5" />
                          Enviar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Secao>
            );
          })}
        </div>
      )}

      <Secao
        className="mt-8"
        titulo="Modelos de mensagem"
        acao={
          <button
            onClick={() => {
              restaurar();
              toast("Modelos restaurados");
            }}
            className="flex items-center gap-1 text-[13.5px] font-medium text-brand-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrões
          </button>
        }
      >
        <ul className="space-y-2.5">
          {db.mensagemModelos.map((m) => (
            <li key={m.id}>
              <button onClick={() => setEditando(m)} className="tap card flex w-full items-start gap-3 px-4 py-3.5 text-left">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">{m.titulo}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{m.texto}</p>
                </div>
                <Pencil className="mt-1 h-4 w-4 shrink-0 text-subtle" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-subtle">Na versão 2, estes modelos disparam sozinhos pelo WhatsApp nos gatilhos certos.</p>
      </Secao>

      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={zap.tutor.id} petId={zap.pet.id} atendimentoId={zap.atendimentoId} gatilho={zap.gatilho} />}
      <EditarModelo modelo={editando} onFechar={() => setEditando(null)} />
    </div>
  );
}

function EditarModelo({ modelo, onFechar }: { modelo: MensagemModelo | null; onFechar: () => void }) {
  const salvar = useApp((s) => s.salvarModelo);
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  if (modelo && ultimo !== modelo.id) {
    setUltimo(modelo.id);
    setTexto(modelo.texto);
  }
  if (!modelo && ultimo !== null) setUltimo(null);

  const inserir = (chave: string) => {
    const el = ref.current;
    const tag = `{${chave}}`;
    if (!el) return setTexto((t) => t + tag);
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, ini) + tag + texto.slice(fim));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + tag.length, ini + tag.length);
    });
  };

  return (
    <Folha aberta={!!modelo} onFechar={onFechar} titulo={modelo?.titulo ?? ""}>
      <textarea ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} className="input resize-none leading-relaxed" />
      <p className="label mt-3">Toque para inserir um dado</p>
      <div className="flex flex-wrap gap-2">
        {VARIAVEIS.map((v) => (
          <button key={v.chave} onClick={() => inserir(v.chave)} className={cx("tap rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12.5px] font-medium text-brand-700")}>
            {v.rotulo}
          </button>
        ))}
      </div>
      <Botao
        className="mt-5"
        onClick={() => {
          if (!modelo) return;
          salvar(modelo.id, texto);
          toast("Modelo salvo");
          onFechar();
        }}
      >
        Salvar modelo
      </Botao>
    </Folha>
  );
}
