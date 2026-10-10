"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/data/store";
import type { Especie, Pet, Porte } from "@/domain/types";
import { Trash2 } from "lucide-react";
import { bloqueioExcluirPet } from "@/domain/edicao";
import { ALERGIA_SEM_DETALHE, PELAGENS, SEM_ALERGIA, TEMPERAMENTOS, normalizarAlergia } from "@/domain/ficha-pet";
import { semAcento } from "@/domain/racas";
import { Botao, Campo, Folha, cx } from "./ui";
import { CampoRaca } from "./campo-raca";
import { useToast } from "./providers";

const chip = (ativo: boolean) =>
  cx("tap rounded-xl border px-3.5 py-2.5 text-[14px] font-medium", ativo ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted");

/** Opções de um toque e, se nenhuma servir, "Outra" abre o campo de texto. Tocar de novo desmarca. */
export function EscolhaComOutra({
  opcoes,
  valor,
  onChange,
  rotuloOutra = "Outra",
  placeholder,
}: {
  opcoes: readonly string[];
  valor?: string;
  onChange: (v: string | undefined) => void;
  rotuloOutra?: string;
  placeholder?: string;
}) {
  const casada = opcoes.find((o) => semAcento(o) === semAcento(valor ?? ""));
  const [outraAberta, setOutraAberta] = useState(false);
  const modoOutra = outraAberta || (!!valor?.trim() && !casada);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={casada === o}
            className={chip(casada === o)}
            onClick={() => {
              setOutraAberta(false);
              onChange(casada === o ? undefined : o);
            }}
          >
            {o}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={modoOutra}
          className={chip(modoOutra)}
          onClick={() => {
            if (modoOutra) {
              setOutraAberta(false);
              if (!casada) onChange(undefined);
            } else {
              setOutraAberta(true);
              onChange(undefined);
            }
          }}
        >
          {rotuloOutra}
        </button>
      </div>
      {modoOutra && (
        <input className="input mt-2" autoFocus={outraAberta} value={casada ? "" : (valor ?? "")} onChange={(e) => onChange(e.target.value || undefined)} placeholder={placeholder} />
      )}
    </div>
  );
}

/** Alergia: Não / Sim, e se sim, a quê. */
export function EscolhaAlergia({ valor, onChange }: { valor?: string; onChange: (v: string | undefined) => void }) {
  const a = normalizarAlergia(valor);
  const nao = a === SEM_ALERGIA;
  const sim = !!a && !nao;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={nao} className={chip(nao)} onClick={() => onChange(nao ? undefined : SEM_ALERGIA)}>
          Não tem
        </button>
        <button type="button" aria-pressed={sim} className={chip(sim)} onClick={() => onChange(sim ? undefined : ALERGIA_SEM_DETALHE)}>
          Sim, tem alergia
        </button>
      </div>
      {sim && (
        <input
          className="input mt-2"
          autoFocus={a === ALERGIA_SEM_DETALHE}
          value={a === ALERGIA_SEM_DETALHE ? "" : (valor ?? "")}
          onChange={(e) => onChange(e.target.value.trim() ? e.target.value : ALERGIA_SEM_DETALHE)}
          placeholder="A quê? Ex.: perfume, shampoo com corante"
        />
      )}
    </div>
  );
}

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
      <div>
        <span className="label">Raça</span>
        <CampoRaca valor={valor.raca} onChange={(v) => set("raca", v)} especie={valor.especie} />
      </div>
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
      <div>
        <span className="label">Pelagem</span>
        <EscolhaComOutra opcoes={PELAGENS} valor={valor.pelagem} onChange={(v) => set("pelagem", v)} placeholder="Ex.: dupla, encaracolada" />
      </div>
      <div>
        <span className="label">Temperamento</span>
        <EscolhaComOutra opcoes={TEMPERAMENTOS} valor={valor.temperamento} onChange={(v) => set("temperamento", v)} rotuloOutra="Outro" placeholder="Ex.: brincalhão, arisco" />
      </div>
      <div>
        <span className="label">Possui alergia?</span>
        <EscolhaAlergia valor={valor.alergias} onChange={(v) => set("alergias", v)} />
        <span className="mt-1.5 block text-[12.5px] text-muted">Alergia e pet bravo aparecem em destaque na agenda e na tela do banhista.</span>
      </div>
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
