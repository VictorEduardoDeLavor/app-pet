"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleMinus, ClipboardList, MessageCircle, Plus, Search } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento, PlanoPet } from "@/domain/types";
import { planoAtivoDoPet, planosAVencer, porId, saldoPlano, statusEfetivoPlano } from "@/domain/rules";
import { dataCurta, diferencaDias, hoje, moeda } from "@/domain/format";
import { Botao, Campo, Chip, Filtros, Folha, PetAvatar, Progresso, TituloVoltar, Vazio, cx } from "@/components/ui";
import { SeletorForma } from "@/components/pagamento-folha";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { useToast } from "@/components/providers";

type Filtro = "ativos" | "vencer" | "encerrados" | "todos";

export default function PlanosPagina() {
  return (
    <Suspense>
      <Planos />
    </Suspense>
  );
}

function Planos() {
  const db = useDb();
  const params = useSearchParams();
  const toast = useToast();
  const darBaixa = useApp((s) => s.darBaixaManual);
  const T = hoje();
  const [filtro, setFiltro] = useState<Filtro>(params.get("filtro") === "vencer" ? "vencer" : "ativos");
  const [busca, setBusca] = useState("");
  const [vender, setVender] = useState<string | null>(params.get("vender"));
  const [zap, setZap] = useState<PlanoPet | null>(null);
  const [baixa, setBaixa] = useState<PlanoPet | null>(null);

  const aVencer = useMemo(() => new Set(planosAVencer(db, T).map((p) => p.id)), [db, T]);
  const ativos = db.planosPet.filter((p) => statusEfetivoPlano(db, p, T) === "ativo");
  const restantes = ativos.reduce((s, p) => s + saldoPlano(db, p.id), 0);

  const lista = db.planosPet
    .filter((p) => {
      const st = statusEfetivoPlano(db, p, T);
      if (filtro === "ativos" && st !== "ativo") return false;
      if (filtro === "vencer" && !aVencer.has(p.id)) return false;
      if (filtro === "encerrados" && st === "ativo") return false;
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      const pet = porId(db.pets, p.petId);
      const tutor = porId(db.tutores, p.tutorId);
      return [p.nome, pet?.nome, tutor?.nome].some((x) => x?.toLowerCase().includes(q));
    })
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));

  return (
    <div>
      <TituloVoltar
        voltarPara="/mais"
        acao={
          <button onClick={() => setVender("")} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Plus className="h-[18px] w-[18px]" />
            Vender
          </button>
        }
      >
        Planos e pacotes
      </TituloVoltar>

      <div className="mx-5 mt-2 grid grid-cols-3 divide-x divide-brand-200/70 rounded-[20px] bg-surface py-4 text-center">
        <div>
          <p className="text-[22px] font-bold">{ativos.length}</p>
          <p className="text-[12px] text-muted">Planos ativos</p>
        </div>
        <div>
          <p className="text-[22px] font-bold">{restantes}</p>
          <p className="text-[12px] text-muted">Banhos restantes</p>
        </div>
        <div>
          <p className={cx("text-[22px] font-bold", aVencer.size > 0 && "text-warn-700")}>{aVencer.size}</p>
          <p className="text-[12px] text-muted">A vencer</p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
          <input className="input bg-surface pl-11" placeholder="Buscar por plano, tutor ou pet" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Filtros
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: "ativos", rotulo: "Ativos", contagem: ativos.length },
            { valor: "vencer", rotulo: "A vencer", contagem: aVencer.size },
            { valor: "encerrados", rotulo: "Encerrados" },
            { valor: "todos", rotulo: "Todos" },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <Vazio icone={<ClipboardList className="h-6 w-6" />} titulo="Nenhum plano aqui" texto="Venda um pacote de banhos para clientes recorrentes." />
      ) : (
        <ul className="mt-4 space-y-3 px-5">
          {lista.map((p) => {
            const pet = porId(db.pets, p.petId)!;
            const tutor = porId(db.tutores, p.tutorId);
            const saldo = saldoPlano(db, p.id);
            const usados = p.totalUsos - saldo;
            const st = statusEfetivoPlano(db, p, T);
            const faltam = diferencaDias(T, p.vencimento);
            return (
              <li key={p.id} className="card px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{p.nome}</p>
                  {st === "ativo" ? (
                    aVencer.has(p.id) ? <Chip tom="warn">{saldo <= 1 ? "Último banho" : `Vence em ${faltam} dias`}</Chip> : <Chip tom="ok">Ativo</Chip>
                  ) : (
                    <Chip tom="neutral">{st === "finalizado" ? "Concluído" : st === "vencido" ? "Vencido" : "Cancelado"}</Chip>
                  )}
                </div>
                <Link href={`/pets/${pet.id}`} className="mt-2 flex items-center gap-3">
                  <PetAvatar pet={pet} tamanho={40} />
                  <div>
                    <p className="font-semibold">{pet.nome}</p>
                    <p className="text-[13px] text-muted">Tutor: {tutor?.nome}</p>
                  </div>
                </Link>
                <div className="mt-3 rounded-2xl bg-surface px-3.5 py-3">
                  <div className="mb-2 flex justify-between text-[13.5px]">
                    <span>
                      {usados} de {p.totalUsos} usados
                    </span>
                    <span className="font-semibold text-brand-700">{saldo} disponíveis</span>
                  </div>
                  <Progresso valor={usados} total={p.totalUsos} />
                </div>
                <p className="mt-2 text-[12.5px] text-muted">
                  Validade: {dataCurta(p.vencimento)} · pago {moeda(p.preco)}
                  {p.observacoes && ` · ${p.observacoes}`}
                </p>
                {st === "ativo" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setBaixa(p)} className="tap flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ok-500 text-[14px] font-semibold text-white">
                      <CircleMinus className="h-4 w-4" />
                      Dar baixa
                    </button>
                    <button onClick={() => setZap(p)} aria-label="Avisar tutor" className="tap grid h-10 w-12 place-items-center rounded-xl border border-line text-brand-600">
                      <MessageCircle className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Folha aberta={!!baixa} onFechar={() => setBaixa(null)} titulo="Dar baixa manual">
        {baixa && (
          <>
            <p className="text-[14.5px]">
              Registrar 1 uso do plano de <strong>{porId(db.pets, baixa.petId)?.nome}</strong> sem atendimento na agenda?
            </p>
            <p className="mt-2 text-[13px] text-muted">Atendimentos finalizados na agenda já descontam sozinhos. Use a baixa manual só para banhos fora da agenda.</p>
            <Botao
              className="mt-5"
              onClick={() => {
                const r = darBaixa(baixa.id);
                if (!r.ok) return toast(r.erro, "erro");
                toast("1 uso descontado do plano");
                setBaixa(null);
              }}
            >
              Confirmar baixa
            </Botao>
          </>
        )}
      </Folha>

      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={zap.tutorId} petId={zap.petId} gatilho="renovacao_plano" />}
      <VenderFolha petInicial={vender} onFechar={() => setVender(null)} />
    </div>
  );
}

function VenderFolha({ petInicial, onFechar }: { petInicial: string | null; onFechar: () => void }) {
  const db = useDb();
  const vender = useApp((s) => s.venderPlano);
  const toast = useToast();
  const T = hoje();
  const aberta = petInicial !== null;
  const [petId, setPetId] = useState<string>("");
  const [modeloId, setModeloId] = useState(db.planosModelo[0]?.id ?? "");
  const [preco, setPreco] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (aberta) {
      setPetId(petInicial ?? "");
      setBusca("");
      const m = db.planosModelo[0];
      setModeloId(m?.id ?? "");
      setPreco(m ? String(m.preco) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, petInicial]);

  const pet = porId(db.pets, petId);
  const candidatos = db.pets
    .filter((p) => !planoAtivoDoPet(db, p.id, T))
    .filter((p) => {
      const q = busca.trim().toLowerCase();
      return !q || p.nome.toLowerCase().includes(q) || porId(db.tutores, p.tutorId)?.nome.toLowerCase().includes(q);
    })
    .slice(0, 6);

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Vender plano">
      <div className="space-y-4">
        <div>
          <span className="label">Pet</span>
          {pet ? (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2.5">
              <PetAvatar pet={pet} tamanho={36} />
              <span className="flex-1 font-semibold">
                {pet.nome}
                <span className="block text-[12.5px] font-normal text-muted">{porId(db.tutores, pet.tutorId)?.nome}</span>
              </span>
              <button onClick={() => setPetId("")} className="text-[14px] font-medium text-brand-600">
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Buscar pet ou tutor" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                {candidatos.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setPetId(p.id)} className="tap flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <PetAvatar pet={p} tamanho={32} />
                      <span className="text-[14.5px] font-medium">{p.nome}</span>
                      <span className="text-[12.5px] text-muted">{porId(db.tutores, p.tutorId)?.nome}</span>
                    </button>
                  </li>
                ))}
                {candidatos.length === 0 && <li className="px-3 py-2.5 text-[14px] text-muted">Nenhum pet sem plano encontrado.</li>}
              </ul>
            </>
          )}
        </div>
        <div>
          <span className="label">Pacote</span>
          <div className="space-y-2">
            {db.planosModelo.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setModeloId(m.id);
                  setPreco(String(m.preco));
                }}
                className={cx("tap flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left", m.id === modeloId ? "border-brand-600 bg-brand-50" : "border-line")}
              >
                <span>
                  <span className="block text-[15px] font-medium">{m.nome}</span>
                  <span className="block text-[12.5px] text-muted">
                    {m.quantidadeUsos} usos · validade {m.validadeDias} dias
                  </span>
                </span>
                <span className="font-semibold">{moeda(m.preco)}</span>
              </button>
            ))}
          </div>
        </div>
        <Campo rotulo="Preço cobrado (R$)">
          <input className="input text-[17px] font-semibold" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </Campo>
        <div>
          <span className="label">Pagamento</span>
          <SeletorForma valor={forma} onChange={setForma} />
        </div>
        <Botao
          onClick={() => {
            const r = vender({ modeloId, petId, preco: Number(preco.replace(",", ".")), formaPagamento: forma, inicio: T });
            if (!r.ok) return toast(r.erro, "erro");
            toast(`Plano vendido para ${pet?.nome}. Receita no caixa de hoje.`);
            onFechar();
          }}
          disabled={!pet}
        >
          Confirmar venda
        </Botao>
      </div>
    </Folha>
  );
}
