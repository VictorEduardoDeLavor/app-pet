"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Pencil, RotateCcw, Send } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { GatilhoMensagem, MensagemModelo, Pet, Tutor } from "@/domain/types";
import { VARIAVEIS, modeloPorGatilho } from "@/domain/messages";
import { lembreteEnviado, textoVencimento, vacinasVencendo } from "@/domain/vacinas";
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
  vacinaId?: string;
  contexto: string;
  enviado: boolean;
}

const GRUPOS: { gatilho: GatilhoMensagem; titulo: string }[] = [
  { gatilho: "acompanhamento", titulo: "Link de acompanhamento" },
  { gatilho: "pet_pronto", titulo: "Pet pronto" },
  { gatilho: "confirmacao", titulo: "Confirmar horário" },
  { gatilho: "lembrete", titulo: "Lembrete de amanhã" },
  { gatilho: "feedback", titulo: "Feedback de ontem" },
  { gatilho: "renovacao_plano", titulo: "Renovar plano" },
  { gatilho: "vacina", titulo: "Vacinas vencendo" },
  { gatilho: "cliente_sumido", titulo: "Clientes sumidos" },
];

export default function Mensagens() {
  const db = useDb();
  const restaurar = useApp((s) => s.restaurarModelos);
  const toast = useToast();
  const T = hoje();
  const [zap, setZap] = useState<Sugestao | null>(null);
  const [editando, setEditando] = useState<MensagemModelo | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  const sugestoes = useMemo(() => {
    const enviadoHoje = (gatilho: GatilhoMensagem, tutorId: string, atendimentoId?: string) => {
      const modelo = modeloPorGatilho(db, gatilho);
      return db.mensagensEnvios.some(
        (e) => e.modeloId === modelo?.id && e.tutorId === tutorId && (atendimentoId ? e.atendimentoId === atendimentoId : true) && dataDoIso(e.enviadoEm) === T,
      );
    };
    const lista: Sugestao[] = [];
    const add = (gatilho: GatilhoMensagem, tutorId: string, petId: string, contexto: string, atendimentoId?: string, vacinaId?: string) => {
      const tutor = porId(db.tutores, tutorId);
      const pet = porId(db.pets, petId);
      if (!tutor || !pet || !tutor.consentimentoWhatsapp) return;
      // Modelo desligado em "Modelos de mensagem" não gera sugestão.
      if (modeloPorGatilho(db, gatilho)?.ativo === false) return;
      lista.push({ chave: `${gatilho}-${vacinaId ?? atendimentoId ?? petId}`, gatilho, tutor, pet, atendimentoId, vacinaId, contexto, enviado: enviadoHoje(gatilho, tutorId, atendimentoId) });
    };
    for (const a of atendimentosDoDia(db, T)) {
      // Link para o tutor acompanhar as fotos (e o carro): de quem está no pet shop ou a caminho hoje.
      if (a.status === "em_atendimento" || a.status === "confirmado") add("acompanhamento", a.tutorId, a.petId, a.status === "em_atendimento" ? "No banho agora" : `Hoje às ${a.hora}`, a.id);
      if (a.status === "finalizado" && a.transporte !== "entrega" && a.transporte !== "busca_e_entrega") add("pet_pronto", a.tutorId, a.petId, `Finalizado · ${a.hora}`, a.id);
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
    for (const v of vacinasVencendo(db, T)) {
      const pet = porId(db.pets, v.petId);
      if (!pet || lembreteEnviado(db, v)) continue;
      add("vacina", pet.tutorId, pet.id, `${v.nome} · ${v.proximaEm! < T ? "venceu" : "vence"} ${textoVencimento(v.proximaEm!, T)}`, undefined, v.id);
    }
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
          <button onClick={() => setRestaurando(true)} className="flex items-center gap-1 text-[13.5px] font-medium text-brand-600">
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrões
          </button>
        }
      >
        <ul className="space-y-2.5">
          {db.mensagemModelos.map((m) => (
            <li key={m.id}>
              <button onClick={() => setEditando(m)} className="tap card flex w-full items-start gap-3 px-4 py-3.5 text-left">
                <div className={cx("min-w-0 flex-1", !m.ativo && "opacity-60")}>
                  <p className="flex items-center gap-2 text-[14.5px] font-semibold">
                    {m.titulo}
                    {!m.ativo && <Chip tom="neutral">Desligado</Chip>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{m.texto}</p>
                </div>
                <Pencil className="mt-1 h-4 w-4 shrink-0 text-subtle" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-subtle">Desligue um modelo para ele não aparecer nas sugestões do dia.</p>
      </Secao>

      {zap && (
        <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={zap.tutor.id} petId={zap.pet.id} atendimentoId={zap.atendimentoId} vacinaId={zap.vacinaId} gatilho={zap.gatilho} />
      )}
      <EditarModelo modelo={editando} onFechar={() => setEditando(null)} />
      <Folha aberta={restaurando} onFechar={() => setRestaurando(false)} titulo="Restaurar os textos padrão?">
        <p className="text-[14.5px] text-muted">Os títulos e textos que você mudou voltam ao original e todos os modelos ficam ligados. Modelos novos do app também entram.</p>
        <Botao
          variante="perigo"
          className="mt-5"
          onClick={() => {
            restaurar();
            toast("Modelos restaurados");
            setRestaurando(false);
          }}
        >
          Restaurar padrões
        </Botao>
      </Folha>
    </div>
  );
}

function EditarModelo({ modelo, onFechar }: { modelo: MensagemModelo | null; onFechar: () => void }) {
  const salvar = useApp((s) => s.editarModelo);
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  if (modelo && ultimo !== modelo.id) {
    setUltimo(modelo.id);
    setTexto(modelo.texto);
    setTitulo(modelo.titulo);
    setAtivo(modelo.ativo);
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
    <Folha aberta={!!modelo} onFechar={onFechar} titulo="Editar modelo">
      <input className="input mb-3 font-semibold" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título do modelo" />
      <textarea ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} className="input resize-none leading-relaxed" />
      <p className="label mt-3">Toque para inserir um dado</p>
      <div className="flex flex-wrap gap-2">
        {VARIAVEIS.map((v) => (
          <button key={v.chave} onClick={() => inserir(v.chave)} className={cx("tap rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12.5px] font-medium text-brand-700")}>
            {v.rotulo}
          </button>
        ))}
      </div>
      <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14.5px]">
        <span>
          Modelo ligado
          <span className="block text-[12.5px] text-muted">Desligado não aparece nas sugestões do dia.</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
      </label>
      <Botao
        className="mt-5"
        onClick={() => {
          if (!modelo) return;
          const r = salvar(modelo.id, { titulo, texto, ativo });
          if (!r.ok) return toast(r.erro, "erro");
          toast("Modelo salvo");
          onFechar();
        }}
      >
        Salvar modelo
      </Botao>
    </Folha>
  );
}
