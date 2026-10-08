"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ClipboardList, Clock, ListChecks, LogIn, LogOut, RotateCcw, Scissors, ShoppingBag, Store, UserCog, Wallet } from "lucide-react";
import { useApp, useDb, useEu } from "@/data/store";
import { resumoCaixa, planosAVencer, resumoProfissional } from "@/domain/rules";
import { NOME_PAPEL, inicioDoPapel, pode } from "@/domain/permissoes";
import { hoje, iniciais, moedaCurta } from "@/domain/format";
import { Botao, Chip, Folha, Titulo, cx } from "@/components/ui";
import { useSessao, useToast } from "@/components/providers";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Mais() {
  const db = useDb();
  const resetar = useApp((s) => s.resetar);
  const atualizar = useApp((s) => s.atualizarPetshop);
  const toast = useToast();
  const modo = useApp((s) => s.modo);
  const entrarComo = useApp((s) => s.entrarComo);
  const router = useRouter();
  const eu = useEu();
  const papel = eu?.papel ?? "dono";
  const { email, temSupabase, sair } = useSessao();
  const [confirmarReset, setConfirmarReset] = useState(false);
  const T = hoje();
  const caixa = resumoCaixa(db, T);
  const ps = db.petshop;
  const minhaFila = eu ? resumoProfissional(db, eu.id, T) : undefined;
  const mostrarFila = !!eu && pode(papel, "fila") && (papel === "banhista" || (minhaFila?.total ?? 0) > 0);

  return (
    <div>
      <Titulo>{papel === "banhista" ? "Conta" : "Mais"}</Titulo>

      {eu && (
        <div className="card mx-5 mb-4 overflow-hidden shadow-[var(--shadow-card)]">
          <div className="relative h-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fotos/inicio-sofa.webp" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 40%" }} />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(40_26_99/0.05),rgb(40_26_99/0.45))]" />
          </div>
          <div className="flex items-end gap-3 px-4 pb-3.5">
            <span className="-mt-7 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[16px] font-bold text-white shadow-md ring-4 ring-white">
              {iniciais(eu.nome)}
            </span>
            <div className="min-w-0 pt-2">
              <p className="truncate font-semibold">{eu.nome}</p>
              <p className="truncate text-[13px] text-muted">
                {NOME_PAPEL[eu.papel]} · {ps.nome}
              </p>
            </div>
          </div>
        </div>
      )}

      {(mostrarFila || papel !== "banhista") && (
        <ul className="mx-5 divide-y divide-line rounded-[20px] border border-line">
          {mostrarFila && (
            <Item href="/fila" icone={<ListChecks />} titulo="Minha fila" detalhe={`${minhaFila!.concluidos} de ${minhaFila!.total} prontos hoje`} />
          )}
          {pode(papel, "financeiro") && <Item href="/financeiro" icone={<Wallet />} titulo="Financeiro" detalhe={`Caixa de hoje ${moedaCurta(caixa.saldo)}`} />}
          {pode(papel, "planos") && <Item href="/planos" icone={<ClipboardList />} titulo="Planos e pacotes" detalhe={`${planosAVencer(db, T).length} a vencer`} />}
          {pode(papel, "servicos") && (
            <Item href="/servicos" icone={<Scissors />} titulo="Serviços e preços" detalhe={`${db.servicos.filter((s) => s.ativo).length} serviços`} />
          )}
          {pode(papel, "equipe") && <Item href="/equipe" icone={<UserCog />} titulo="Equipe" detalhe={`${db.membros.filter((m) => m.ativo).length} pessoas`} />}
          {pode(papel, "produtos") && <Item href="/produtos" icone={<ShoppingBag />} titulo="Produtos" selo={<Chip tom="neutral">Em breve</Chip>} />}
        </ul>
      )}

      {pode(papel, "configuracoes") && (
        <section className="mx-5 mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-[17px] font-semibold">
            <Store className="h-5 w-5 text-brand-600" />
            {ps.nome}
          </h2>
          <div className="space-y-4 rounded-[20px] bg-surface px-4 py-4">
            <div>
              <p className="label flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Funcionamento · {ps.abre} às {ps.fecha}
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {DIAS.map((d, i) => {
                  const on = ps.diasAbertos.includes(i);
                  return (
                    <button
                      key={d}
                      onClick={() => atualizar({ diasAbertos: on ? ps.diasAbertos.filter((x) => x !== i) : [...ps.diasAbertos, i].sort() })}
                      className={cx("tap rounded-xl py-2 text-[12.5px] font-medium", on ? "bg-brand-600 text-white" : "bg-white text-muted")}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 text-[14.5px]">
              <span>
                Falta consome 1 uso do plano
                <span className="block text-[12.5px] text-muted">Quando o tutor não aparece.</span>
              </span>
              <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ps.faltaConsomeUso} onChange={(e) => atualizar({ faltaConsomeUso: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 text-[14.5px]">
              <span>
                Cliente sumido após
                <span className="block text-[12.5px] text-muted">Dias sem visita para sugerir mensagem.</span>
              </span>
              <select
                className="rounded-xl border border-line bg-white px-3 py-2 text-[14.5px]"
                value={ps.diasClienteSumido}
                onChange={(e) => atualizar({ diasClienteSumido: Number(e.target.value) })}
              >
                {[21, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {modo === "demo" && (
        <section className="mx-5 mt-6" aria-label="Ver o app como">
          <h2 className="text-[17px] font-semibold">Ver o app como</h2>
          <p className="mb-3 mt-0.5 text-[13px] text-muted">Cada pessoa da equipe vê só o que usa. Troque para conferir.</p>
          <ul className="space-y-2">
            {db.membros
              .filter((m) => m.ativo)
              .map((m) => {
                const atual = m.id === eu?.id;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        if (atual) return;
                        entrarComo(m.id);
                        toast(`Agora você vê o app como ${m.nome.split(" ")[0]}`);
                        router.push(inicioDoPapel(m.papel));
                      }}
                      className={cx(
                        "tap flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                        atual ? "border-brand-600 bg-brand-50" : "border-line",
                      )}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-[12.5px] font-bold text-brand-700">{iniciais(m.nome)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{m.nome}</span>
                        <span className="block text-[12.5px] text-muted">{NOME_PAPEL[m.papel]}</span>
                      </span>
                      {atual && <Check className="h-5 w-5 text-brand-600" />}
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {modo === "nuvem" ? (
        <section className="mx-5 mt-6 rounded-[20px] border border-line px-4 py-4">
          <p className="text-[14px] font-semibold">Sua conta</p>
          <p className="mt-1 text-[13px] text-muted">{email}</p>
          <button onClick={sair} className="mt-3 flex items-center gap-1.5 text-[14px] font-medium text-bad-700">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </section>
      ) : (
        <section className="mx-5 mt-6 rounded-[20px] border border-dashed border-line px-4 py-4">
          <p className="text-[14px] font-semibold">Demonstração</p>
          <p className="mt-1 text-[13px] text-muted">
            Os dados são fictícios e ficam salvos só neste navegador. Eles são recriados a cada dia para a agenda abrir com movimento.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <button onClick={() => setConfirmarReset(true)} className="flex items-center gap-1.5 text-[14px] font-medium text-brand-600">
              <RotateCcw className="h-4 w-4" />
              Restaurar dados de exemplo
            </button>
            {temSupabase && (
              <button onClick={sair} className="flex items-center gap-1.5 text-[14px] font-medium text-brand-600">
                <LogIn className="h-4 w-4" />
                Entrar ou criar conta
              </button>
            )}
          </div>
        </section>
      )}

      <Folha aberta={confirmarReset} onFechar={() => setConfirmarReset(false)} titulo="Restaurar dados de exemplo?">
        <p className="text-[14.5px] text-muted">Tudo o que você cadastrou neste navegador volta para o exemplo inicial.</p>
        <Botao
          variante="perigo"
          className="mt-5"
          onClick={() => {
            resetar();
            setConfirmarReset(false);
            toast("Dados de exemplo restaurados");
          }}
        >
          Restaurar
        </Botao>
      </Folha>
    </div>
  );
}

function Item({ href, icone, titulo, detalhe, selo }: { href: string; icone: ReactNode; titulo: string; detalhe?: string; selo?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="tap flex items-center gap-3 px-4 py-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 [&>svg]:h-5 [&>svg]:w-5">{icone}</span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">{titulo}</span>
          {detalhe && <span className="block text-[12.5px] text-muted">{detalhe}</span>}
        </span>
        {selo}
        <ChevronRight className="h-5 w-5 text-subtle" />
      </Link>
    </li>
  );
}
