"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarPlus, ChevronRight, Mail, MapPin, MessageCircle, PawPrint, Pencil, Phone, Plus, ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import { useApp, useDb, usePapel } from "@/data/store";
import type { Tutor } from "@/domain/types";
import { bloqueioExcluirTutor } from "@/domain/edicao";
import { pode } from "@/domain/permissoes";
import { useToast } from "@/components/providers";
import type { GatilhoMensagem } from "@/domain/types";
import { clientesSumidos, petsDoTutor, planoAtivoDoPet, porId, saldoPlano } from "@/domain/rules";
import { NOME_PORTE, dataCurta, diferencaDias, hoje, moeda, telefone } from "@/domain/format";
import { Botao, BotaoLink, Campo, Chip, Folha, PetAvatar, Secao, StatusChip, TituloVoltar, Vazio } from "@/components/ui";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { NovoPetFolha } from "@/components/pet-form";

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const T = hoje();
  const [zap, setZap] = useState<{ gatilho: GatilhoMensagem; atendimentoId?: string } | null>(null);
  const [novoPet, setNovoPet] = useState(false);
  const [editando, setEditando] = useState(false);
  const papel = usePapel();
  const router = useRouter();
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
  const compras = pode(papel, "produtos") ? db.vendas.filter((v) => v.tutorId === tutor.id).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)) : [];

  return (
    <div>
      <TituloVoltar
        voltarPara="/clientes"
        acao={
          <button onClick={() => setEditando(true)} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        }
      >
        {tutor.nome}
      </TituloVoltar>

      <div className="mx-5 mt-2 space-y-2.5 rounded-[20px] bg-surface px-4 py-4 text-[14.5px]">
        <p className="flex items-center gap-3">
          <Phone className="h-[18px] w-[18px] text-brand-600" />
          {telefone(tutor.whatsapp)}
          {!tutor.consentimentoWhatsapp && <Chip tom="bad">Sem consentimento</Chip>}
        </p>
        {tutor.email && (
          <p className="flex items-center gap-3 break-all">
            <Mail className="h-[18px] w-[18px] shrink-0 text-brand-600" />
            {tutor.email}
          </p>
        )}
        {tutor.endereco && (
          <p className="flex items-center gap-3">
            <MapPin className="h-[18px] w-[18px] shrink-0 text-brand-600" />
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
        {pets.length > 0 ? (
          <BotaoLink href={`/agenda/novo?pet=${pets[0].id}`} className="h-12" icone={<CalendarPlus className="h-[18px] w-[18px]" />}>
            Agendar
          </BotaoLink>
        ) : (
          <Botao className="h-12" icone={<Plus className="h-[18px] w-[18px]" />} onClick={() => setNovoPet(true)}>
            Cadastrar pet
          </Botao>
        )}
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

      {compras.length > 0 && (
        <Secao className="mt-6" titulo="Compras">
          <ul className="divide-y divide-line">
            {compras.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-3">
                <ShoppingBag className="h-5 w-5 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">{v.itens.map((i) => (i.quantidade === 1 ? i.nome : `${i.quantidade}× ${i.nome}`)).join(", ")}</p>
                  <p className="text-[12.5px] text-muted">{dataCurta(v.criadoEm)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[14px] font-semibold tabular-nums">{moeda(v.total)}</span>
                  {v.status !== "pago" && <Chip tom={v.status === "cancelada" ? "neutral" : "warn"}>{v.status === "cancelada" ? "Cancelada" : "A receber"}</Chip>}
                </div>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={tutor.id} atendimentoId={zap.atendimentoId} gatilho={zap.gatilho} />}
      <NovoPetFolha aberta={novoPet} onFechar={() => setNovoPet(false)} tutorId={tutor.id} />
      <EditarTutorFolha aberta={editando} onFechar={() => setEditando(false)} tutor={tutor} aoExcluir={() => router.replace("/clientes")} />
    </div>
  );
}

function EditarTutorFolha({ aberta, onFechar, tutor, aoExcluir }: { aberta: boolean; onFechar: () => void; tutor: Tutor; aoExcluir: () => void }) {
  const db = useDb();
  const editar = useApp((s) => s.editarTutor);
  const excluir = useApp((s) => s.excluirTutor);
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [consentimento, setConsentimento] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const bloqueio = bloqueioExcluirTutor(db, tutor.id);

  useEffect(() => {
    if (!aberta) return;
    setNome(tutor.nome);
    setZap(telefone(tutor.whatsapp));
    setEmail(tutor.email ?? "");
    setEndereco(tutor.endereco ?? "");
    setConsentimento(tutor.consentimentoWhatsapp);
    setConfirmar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Editar cliente">
      <div className="space-y-4">
        <Campo rotulo="Nome completo">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </Campo>
        <Campo rotulo="WhatsApp com DDD">
          <input className="input" inputMode="tel" value={zap} onChange={(e) => setZap(e.target.value)} />
        </Campo>
        <Campo rotulo="E-mail (opcional)">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo rotulo="Endereço (opcional)" dica="Usado no leva e traz.">
          <input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </Campo>
        <label className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px]">
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
          <span>
            Aceita receber lembretes e avisos pelo WhatsApp
            <span className="block text-[12.5px] text-muted">Registro de consentimento (LGPD).</span>
          </span>
        </label>
      </div>
      <Botao
        className="mt-5"
        onClick={() => {
          const r = editar(tutor.id, { nome, whatsapp: zap, email, endereco, consentimentoWhatsapp: consentimento });
          if (!r.ok) return toast(r.erro, "erro");
          toast("Cadastro atualizado");
          onFechar();
        }}
      >
        Salvar alterações
      </Botao>
      <div className="mt-6 border-t border-line pt-4">
        {!confirmar ? (
          <button onClick={() => (bloqueio ? toast(bloqueio, "erro") : setConfirmar(true))} className="flex items-center gap-1.5 text-[14px] font-medium text-bad-700">
            <Trash2 className="h-4 w-4" />
            Excluir cliente
          </button>
        ) : (
          <div className="rounded-2xl bg-bad-50 px-4 py-3">
            <p className="text-[14px] font-semibold text-bad-700">Excluir {tutor.nome} e os pets dele?</p>
            <p className="mt-0.5 text-[13px] text-muted">Use quando o cliente pedir para apagar os dados (LGPD) ou foi cadastrado por engano. Não dá para desfazer.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Botao variante="contorno" className="!h-11" onClick={() => setConfirmar(false)}>
                Manter
              </Botao>
              <Botao
                variante="perigo"
                className="!h-11"
                onClick={() => {
                  const r = excluir(tutor.id);
                  if (!r.ok) return toast(r.erro, "erro");
                  toast("Cliente excluído");
                  onFechar();
                  aoExcluir();
                }}
              >
                Excluir
              </Botao>
            </div>
          </div>
        )}
      </div>
    </Folha>
  );
}
