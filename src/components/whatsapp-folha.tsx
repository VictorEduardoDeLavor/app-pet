"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, TriangleAlert } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { GatilhoMensagem } from "@/domain/types";
import { linkAgendar, linkWhatsapp, renderMensagem, variaveisDaVacina, variaveisDoAtendimento, type Variaveis } from "@/domain/messages";
import { porId, petsDoTutor, planoAtivoDoPet, saldoPlano } from "@/domain/rules";
import { hoje, primeiroNome, telefone } from "@/domain/format";
import { Aviso, Botao, Folha, cx } from "./ui";
import { useToast } from "./providers";

export function WhatsappFolha({
  aberta,
  onFechar,
  tutorId,
  atendimentoId,
  petId,
  vacinaId,
  gatilho,
}: {
  aberta: boolean;
  onFechar: () => void;
  tutorId: string;
  atendimentoId?: string;
  petId?: string;
  /** Lembrete de vacina: preenche {vacina} e {vencimento}. */
  vacinaId?: string;
  gatilho: GatilhoMensagem;
}) {
  const db = useDb();
  const registrarEnvio = useApp((s) => s.registrarEnvio);
  const toast = useToast();
  const tutor = porId(db.tutores, tutorId);
  const atd = porId(db.atendimentos, atendimentoId);
  const [modeloId, setModeloId] = useState(() => db.mensagemModelos.find((m) => m.gatilho === gatilho)?.id ?? db.mensagemModelos[0].id);
  const modelo = porId(db.mensagemModelos, modeloId)!;

  const vacina = porId(db.vacinas, vacinaId);
  const vars: Variaveis = useMemo(() => {
    if (atd) return variaveisDoAtendimento(db, atd);
    if (vacina) return variaveisDaVacina(db, vacina);
    const pet = porId(db.pets, petId) ?? (tutor ? petsDoTutor(db, tutor.id)[0] : undefined);
    const plano = pet ? planoAtivoDoPet(db, pet.id, hoje()) : undefined;
    const saldo = plano ? saldoPlano(db, plano.id) : undefined;
    return {
      tutor: tutor ? primeiroNome(tutor.nome) : undefined,
      pet: pet?.nome,
      petshop: db.petshop.nome,
      saldo_plano: saldo !== undefined ? `${saldo} ${saldo === 1 ? "banho" : "banhos"}` : undefined,
      agendar: db.petshop.agendamentoOnline ? linkAgendar(db.petshop.slug) : undefined,
    };
  }, [db, atd, vacina, petId, tutor]);

  // O texto só é refeito ao abrir ou trocar de modelo: a atualização automática da tela não apaga o que foi editado.
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (aberta) setTexto(renderMensagem(modelo.texto, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, modeloId]);

  useEffect(() => {
    if (aberta) setModeloId(db.mensagemModelos.find((m) => m.gatilho === gatilho)?.id ?? db.mensagemModelos[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, gatilho]);

  const modelosVisiveis = db.mensagemModelos.filter((m) => m.ativo || m.id === modeloId);

  if (!tutor) return null;
  const faltando = texto.match(/\{\w+\}/g);

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Mensagem no WhatsApp">
      <p className="-mt-1 mb-3 text-[13.5px] text-muted">
        Para {tutor.nome} · {telefone(tutor.whatsapp)}
      </p>
      <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
        {modelosVisiveis.map((m) => (
          <button
            key={m.id}
            onClick={() => setModeloId(m.id)}
            className={cx(
              "tap shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
              m.id === modeloId ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted",
            )}
          >
            {m.titulo}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[12.5px] text-muted">Modelo preenchido com os dados reais. Você pode editar antes de enviar.</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        className="input resize-none bg-surface leading-relaxed"
        aria-label="Texto da mensagem"
      />
      {faltando && (
        <Aviso
          className="mt-3"
          icone={<TriangleAlert className="h-5 w-5" />}
          titulo="Faltam dados nesta mensagem"
          texto={`Complete ou apague: ${faltando.join(", ")}`}
        />
      )}
      {!tutor.consentimentoWhatsapp && (
        <Aviso className="mt-3" tom="bad" icone={<TriangleAlert className="h-5 w-5" />} titulo="Tutor sem consentimento de WhatsApp" />
      )}
      <div className="mt-4 grid grid-cols-[1fr_1.6fr] gap-3">
        <Botao
          variante="contorno"
          icone={<Copy className="h-[18px] w-[18px]" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              toast("Texto copiado");
            } catch {
              toast("Não foi possível copiar", "erro");
            }
          }}
        >
          Copiar
        </Botao>
        <a
          href={linkWhatsapp(tutor.whatsapp, texto)}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            registrarEnvio(modelo.id, tutor.id, atd?.id);
            onFechar();
          }}
          className="tap inline-flex h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-ok-500 px-5 text-[15px] font-semibold text-white hover:bg-ok-700"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          Abrir WhatsApp
        </a>
      </div>
    </Folha>
  );
}
