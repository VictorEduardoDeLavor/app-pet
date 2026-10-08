"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, ChevronRight, MapPin, MessageCircle, PawPrint, Phone, Plus, TriangleAlert } from "lucide-react";
import { useDb } from "@/data/store";
import type { GatilhoMensagem } from "@/domain/types";
import { clientesSumidos, petsDoTutor, planoAtivoDoPet, porId, saldoPlano } from "@/domain/rules";
import { NOME_PORTE, dataCurta, diferencaDias, hoje, moeda, telefone } from "@/domain/format";
import { Botao, BotaoLink, Chip, PetAvatar, Secao, StatusChip, TituloVoltar, Vazio } from "@/components/ui";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { NovoPetFolha } from "@/components/pet-form";

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const T = hoje();
  const [zap, setZap] = useState<{ gatilho: GatilhoMensagem; atendimentoId?: string } | null>(null);
  const [novoPet, setNovoPet] = useState(false);
  const tutor = porId(db.tutores, id);

  if (!tutor) {
    return (
      <>
        <TituloVoltar voltarPara="/clientes">Cliente</TituloVoltar>
        <Vazio icone={<PawPrint className="h-6 w-6" />} titulo="Cliente não encontrado" />
      </>
    );
  }

  const pets = petsDoTutor(db, tutor.id);
  const historico = db.atendimentos
    .filter((a) => a.tutorId === tutor.id)
    .sort((a, b) => (a.data + a.hora < b.data + b.hora ? 1 : -1));
  const proximo = [...historico].reverse().find((a) => a.data >= T && ["agendado", "confirmado"].includes(a.status));
  const sumido = clientesSumidos(db, T).some((c) => c.tutor.id === tutor.id);

  return (
    <div>
      <TituloVoltar voltarPara="/clientes">{tutor.nome}</TituloVoltar>

      <div className="mx-5 mt-2 space-y-2.5 rounded-[20px] bg-surface px-4 py-4 text-[14.5px]">
        <p className="flex items-center gap-3">
          <Phone className="h-[18px] w-[18px] text-brand-600" />
          {telefone(tutor.whatsapp)}
          {!tutor.consentimentoWhatsapp && <Chip tom="bad">Sem consentimento</Chip>}
        </p>
        {tutor.endereco && (
          <p className="flex items-center gap-3">
            <MapPin className="h-[18px] w-[18px] text-brand-600" />
            {tutor.endereco}
          </p>
        )}
        <p className="text-[13px] text-muted">Cliente desde {dataCurta(tutor.criadoEm)}</p>
      </div>

      <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
        <Botao
          variante="contorno"
          className="h-12"
          icone={<MessageCircle className="h-[18px] w-[18px]" />}
          onClick={() => setZap(proximo ? { gatilho: "lembrete", atendimentoId: proximo.id } : { gatilho: sumido ? "cliente_sumido" : "feedback" })}
        >
          WhatsApp
        </Botao>
        <BotaoLink href={`/agenda/novo?pet=${pets[0]?.id ?? ""}`} className="h-12" icone={<CalendarPlus className="h-[18px] w-[18px]" />}>
          Agendar
        </BotaoLink>
      </div>

      <Secao
        className="mt-6"
        titulo={`Pets (${pets.length})`}
        acao={
          <button onClick={() => setNovoPet(true)} className="flex items-center gap-1 text-[14px] font-medium text-brand-600">
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        }
      >
        <ul className="space-y-2.5">
          {pets.map((p) => {
            const plano = planoAtivoDoPet(db, p.id, T);
            return (
              <li key={p.id}>
                <Link href={`/pets/${p.id}`} className="tap card flex items-center gap-3 px-4 py-3">
                  <PetAvatar pet={p} tamanho={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.nome}</p>
                    <p className="truncate text-[13px] text-muted">
                      {p.raca} · {NOME_PORTE[p.porte]}
                      {p.ultimaVisita && ` · há ${diferencaDias(p.ultimaVisita, T)} dias`}
                    </p>
                    {(p.alergias || p.cuidados || plano) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(p.alergias || p.cuidados) && (
                          <Chip tom="warn">
                            <TriangleAlert className="mr-1 h-3 w-3" />
                            {p.alergias ? `Alergia: ${p.alergias}` : "Cuidado especial"}
                          </Chip>
                        )}
                        {plano && <Chip tom="info">Plano · {saldoPlano(db, plano.id)} de {plano.totalUsos}</Chip>}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Secao>

      <Secao className="mt-6" titulo="Histórico">
        {historico.length === 0 ? (
          <p className="text-[14px] text-muted">Nenhum atendimento ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {historico.map((a) => (
              <li key={a.id}>
                <Link href={`/atendimentos/${a.id}`} className="tap flex items-center gap-3 py-3">
                  <div className="w-[68px] shrink-0 text-[13px] tabular-nums text-muted">
                    {dataCurta(a.data).slice(0, 5)}
                    <br />
                    {a.hora}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium">{porId(db.pets, a.petId)?.nome}</p>
                    <p className="truncate text-[12.5px] text-muted">{a.itens.map((i) => i.nome).join(" + ")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip status={a.status} />
                    <span className="text-[12.5px] text-muted">{a.valorTotal > 0 ? moeda(a.valorTotal) : "Plano"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={tutor.id} atendimentoId={zap.atendimentoId} gatilho={zap.gatilho} />}
      <NovoPetFolha aberta={novoPet} onFechar={() => setNovoPet(false)} tutorId={tutor.id} />
    </div>
  );
}
