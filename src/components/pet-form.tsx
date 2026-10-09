"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/data/store";
import type { Especie, Pet, Porte } from "@/domain/types";
import { Trash2 } from "lucide-react";
import { bloqueioExcluirPet } from "@/domain/edicao";
import { Botao, Campo, Folha, cx } from "./ui";
import { useToast } from "./providers";

type Rascunho = Omit<Pet, "id" | "tutorId">;

const VAZIO: Rascunho = { nome: "", especie: "cao", raca: "", porte: "P" };

export function CamposPet({ valor, onChange }: { valor: Rascunho; onChange: (v: Rascunho) => void }) {
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => onChange({ ...valor, [k]: v });
  const Opcoes = <T extends string>({ itens, atual, on }: { itens: { v: T; r: string }[]; atual?: T; on: (v: T) => void }) => (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
      {itens.map((i) => (
        <button
          key={i.v}
          type="button"
          onClick={() => on(i.v)}
          className={cx("tap rounded-xl border py-2.5 text-[14px] font-medium", atual === i.v ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
        >
          {i.r}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-4">
      <Campo rotulo="Nome">
        <input className="input" value={valor.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Thor" />
      </Campo>
      <div>
        <span className="label">Espécie</span>
        <Opcoes itens={[{ v: "cao" as Especie, r: "Cão" }, { v: "gato" as Especie, r: "Gato" }]} atual={valor.especie} on={(v) => set("especie", v)} />
      </div>
      <Campo rotulo="Raça">
        <input className="input" value={valor.raca} onChange={(e) => set("raca", e.target.value)} placeholder="Ex.: Golden Retriever ou SRD" />
      </Campo>
      <div>
        <span className="label">Porte (define preço e duração)</span>
        <Opcoes itens={(["P", "M", "G", "GG"] as Porte[]).map((p) => ({ v: p, r: p }))} atual={valor.porte} on={(v) => set("porte", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Sexo</span>
          <Opcoes itens={[{ v: "M" as const, r: "Macho" }, { v: "F" as const, r: "Fêmea" }]} atual={valor.sexo} on={(v) => set("sexo", v)} />
        </div>
        <Campo rotulo="Peso (kg)">
          <input className="input" inputMode="decimal" value={valor.pesoKg ?? ""} onChange={(e) => set("pesoKg", e.target.value ? Number(e.target.value.replace(",", ".")) : undefined)} />
        </Campo>
      </div>
      <Campo rotulo="Nascimento (opcional)" dica={valor.nascimento ? idade(valor.nascimento) : "Para saber a idade e lembrar do aniversário."}>
        <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={valor.nascimento ?? ""} onChange={(e) => set("nascimento", e.target.value || undefined)} />
      </Campo>
      <Campo rotulo="Pelagem">
        <input className="input" value={valor.pelagem ?? ""} onChange={(e) => set("pelagem", e.target.value || undefined)} placeholder="Ex.: longa, dupla" />
      </Campo>
      <Campo rotulo="Temperamento">
        <input className="input" value={valor.temperamento ?? ""} onChange={(e) => set("temperamento", e.target.value || undefined)} placeholder="Ex.: manso, medroso, agitado" />
      </Campo>
      <Campo rotulo="Alergias" dica="Aparece em destaque na agenda e na tela do banhista.">
        <input className="input" value={valor.alergias ?? ""} onChange={(e) => set("alergias", e.target.value || undefined)} placeholder="Ex.: perfume" />
      </Campo>
      <Campo rotulo="Cuidados especiais">
        <input className="input" value={valor.cuidados ?? ""} onChange={(e) => set("cuidados", e.target.value || undefined)} placeholder="Ex.: evitar fragrâncias" />
      </Campo>
      <Campo rotulo="Observações">
        <textarea className="input resize-none" rows={2} value={valor.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value || undefined)} />
      </Campo>
    </div>
  );
}

/** "3 anos e 2 meses" a partir da data de nascimento. */
export function idade(nascimento: string, ref = new Date()): string {
  const [a, m, d] = nascimento.split("-").map(Number);
  let meses = (ref.getFullYear() - a) * 12 + (ref.getMonth() + 1 - m) - (ref.getDate() < d ? 1 : 0);
  if (meses < 0) return "";
  const anos = Math.floor(meses / 12);
  meses %= 12;
  if (anos === 0) return meses <= 1 ? "Filhote: menos de 2 meses" : `${meses} meses`;
  return `${anos} ${anos === 1 ? "ano" : "anos"}${meses ? ` e ${meses} ${meses === 1 ? "mês" : "meses"}` : ""}`;
}

export function NovoPetFolha({ aberta, onFechar, tutorId }: { aberta: boolean; onFechar: () => void; tutorId: string }) {
  const criarPet = useApp((s) => s.criarPet);
  const toast = useToast();
  const [r, setR] = useState<Rascunho>(VAZIO);
  useEffect(() => {
    if (aberta) setR(VAZIO);
  }, [aberta]);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Novo pet">
      <CamposPet valor={r} onChange={setR} />
      <Botao
        className="mt-5"
        onClick={() => {
          const res = criarPet({ ...r, raca: r.raca.trim() || "Sem raça definida", tutorId });
          if (!res.ok) return toast(res.erro, "erro");
          toast(`${r.nome.trim()} cadastrado`);
          onFechar();
        }}
      >
        Salvar pet
      </Botao>
    </Folha>
  );
}

export function EditarPetFolha({ aberta, onFechar, pet, aoExcluir }: { aberta: boolean; onFechar: () => void; pet: Pet; aoExcluir?: () => void }) {
  const atualizar = useApp((s) => s.atualizarPet);
  const excluir = useApp((s) => s.excluirPet);
  const db = useApp((s) => s.db);
  const toast = useToast();
  const [r, setR] = useState<Rascunho>(pet);
  const [confirmar, setConfirmar] = useState(false);
  const bloqueio = bloqueioExcluirPet(db, pet.id);
  useEffect(() => {
    if (aberta) {
      setR(pet);
      setConfirmar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={`Editar ${pet.nome}`}>
      <CamposPet valor={r} onChange={setR} />
      <Botao
        className="mt-5"
        onClick={() => {
          if (!r.nome.trim()) return toast("Informe o nome do pet.", "erro");
          atualizar({ ...pet, ...r, nome: r.nome.trim() });
          toast("Ficha atualizada");
          onFechar();
        }}
      >
        Salvar alterações
      </Botao>
      {aoExcluir && (
        <div className="mt-6 border-t border-line pt-4">
          {!confirmar ? (
            <button type="button" onClick={() => (bloqueio ? toast(bloqueio, "erro") : setConfirmar(true))} className="flex items-center gap-1.5 text-[14px] font-medium text-bad-700">
              <Trash2 className="h-4 w-4" />
              Excluir {pet.nome}
            </button>
          ) : (
            <div className="rounded-2xl bg-bad-50 px-4 py-3">
              <p className="text-[14px] font-semibold text-bad-700">Excluir {pet.nome} de vez?</p>
              <p className="mt-0.5 text-[13px] text-muted">Agendamentos em aberto e a carteira de vacinas dele também saem. Não dá para desfazer.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Botao variante="contorno" className="!h-11" onClick={() => setConfirmar(false)}>
                  Manter
                </Botao>
                <Botao
                  variante="perigo"
                  className="!h-11"
                  onClick={() => {
                    const res = excluir(pet.id);
                    if (!res.ok) return toast(res.erro, "erro");
                    toast(`${pet.nome} excluído`);
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
      )}
    </Folha>
  );
}
