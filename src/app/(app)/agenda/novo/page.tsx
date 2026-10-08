"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Info, Plus, Search, TriangleAlert, UserPlus } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Especie, Porte } from "@/domain/types";
import { horariosLivres, montarItens, petsDoTutor, planoAtivoDoPet, porId, profissionais, saldoPlano, petshopAberto } from "@/domain/rules";
import { NOME_PORTE, dataLonga, duracao, hoje, horaAtual, moeda, normalizarWhatsapp, telefone } from "@/domain/format";
import { Aviso, Botao, Campo, PetAvatar, TituloVoltar, cx } from "@/components/ui";
import { useToast } from "@/components/providers";

export default function NovoAgendamentoPagina() {
  return (
    <Suspense>
      <NovoAgendamento />
    </Suspense>
  );
}

function NovoAgendamento() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const criar = useApp((s) => s.criarAtendimento);
  const criarTutor = useApp((s) => s.criarTutor);
  const criarPet = useApp((s) => s.criarPet);

  const petInicial = porId(db.pets, params.get("pet") ?? undefined);
  const [tutorId, setTutorId] = useState<string | undefined>(petInicial?.tutorId);
  const [petId, setPetId] = useState<string | undefined>(petInicial?.id);
  // Começa com o banho marcado (o serviço mais comum); no modo nuvem os IDs são UUID, então busca pela categoria.
  const [servicoIds, setServicoIds] = useState<string[]>(() => {
    const banho = db.servicos.find((s) => s.ativo && s.categoria === "banho") ?? db.servicos.find((s) => s.ativo);
    return banho ? [banho.id] : [];
  });
  const banhistas = profissionais(db);
  const [profId, setProfId] = useState(banhistas[0]?.id ?? "");
  const [data, setData] = useState(params.get("data") ?? hoje());
  const [hora, setHora] = useState<string>("");
  const [valorEditado, setValorEditado] = useState<string | null>(null);
  const [obs, setObs] = useState("");

  const [busca, setBusca] = useState("");
  const [novoTutor, setNovoTutor] = useState(false);
  const [tNome, setTNome] = useState("");
  const [tZap, setTZap] = useState("");
  const [novoPet, setNovoPet] = useState(false);
  const [pNome, setPNome] = useState("");
  const [pRaca, setPRaca] = useState("");
  const [pPorte, setPPorte] = useState<Porte>("P");
  const [pEspecie, setPEspecie] = useState<Especie>("cao");

  const tutor = porId(db.tutores, tutorId);
  const pet = porId(db.pets, petId);
  const pets = tutor ? petsDoTutor(db, tutor.id) : [];
  const plano = pet ? planoAtivoDoPet(db, pet.id, data) : undefined;

  const montagem = useMemo(() => {
    if (!pet || servicoIds.length === 0) return null;
    try {
      return montarItens(db, pet.id, servicoIds, data);
    } catch {
      return null;
    }
  }, [db, pet, servicoIds, data]);

  const livres = useMemo(() => {
    if (!montagem || !profId) return [];
    const todos = horariosLivres(db, profId, data, montagem.duracaoMin);
    // Hoje, só oferece horários que ainda não passaram.
    return data === hoje() ? todos.filter((h) => h > horaAtual()) : todos;
  }, [db, profId, data, montagem]);
  const horaValida = hora && livres.includes(hora) ? hora : "";
  const valor = valorEditado !== null ? Number(valorEditado.replace(",", ".")) || 0 : montagem?.valorSugerido ?? 0;

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return db.tutores.slice(0, 5);
    const digitos = q.replace(/\D/g, "");
    return db.tutores
      .filter(
        (t) =>
          t.nome.toLowerCase().includes(q) ||
          (digitos.length >= 3 && t.whatsapp.includes(digitos)) ||
          petsDoTutor(db, t.id).some((p) => p.nome.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [busca, db]);

  function salvar() {
    if (!pet) return toast("Escolha o pet.", "erro");
    if (!horaValida) return toast("Escolha um horário livre.", "erro");
    const r = criar({ petId: pet.id, servicoIds, profissionalId: profId, data, hora: horaValida, valorTotal: valor, observacoes: obs.trim() || undefined });
    if (!r.ok) return toast(r.erro, "erro");
    toast(`${pet.nome} agendado para ${dataLonga(data).toLowerCase()} às ${horaValida}`);
    router.replace(`/atendimentos/${r.valor}?novo=1`);
  }

  return (
    <div className="pb-6">
      <TituloVoltar>Novo agendamento</TituloVoltar>

      <div className="space-y-6 px-5 pt-2">
        {/* 1. Tutor */}
        <Bloco n={1} titulo="Tutor">
          {tutor && !novoTutor ? (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
              <div className="flex-1">
                <p className="font-semibold">{tutor.nome}</p>
                <p className="text-[13px] text-muted">{telefone(tutor.whatsapp)}</p>
              </div>
              <button
                onClick={() => {
                  setTutorId(undefined);
                  setPetId(undefined);
                }}
                className="text-[14px] font-medium text-brand-600"
              >
                Trocar
              </button>
            </div>
          ) : novoTutor ? (
            <div className="space-y-3 rounded-2xl border border-line p-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">Cadastro rápido</p>
              <input className="input" placeholder="Nome completo do tutor" value={tNome} onChange={(e) => setTNome(e.target.value)} />
              <input className="input" placeholder="WhatsApp com DDD" inputMode="tel" value={tZap} onChange={(e) => setTZap(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Botao variante="fantasma" className="h-11" onClick={() => setNovoTutor(false)}>
                  Voltar
                </Botao>
                <Botao
                  className="h-11"
                  onClick={() => {
                    const r = criarTutor({ nome: tNome, whatsapp: normalizarWhatsapp(tZap) });
                    if (!r.ok) return toast(r.erro, "erro");
                    setTutorId(r.valor);
                    setNovoTutor(false);
                    setNovoPet(true);
                    setTNome("");
                    setTZap("");
                  }}
                >
                  Criar tutor
                </Botao>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
                <input className="input pl-11" placeholder="Buscar por nome, WhatsApp ou pet" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                {resultados.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setTutorId(t.id);
                        const ps = petsDoTutor(db, t.id);
                        setPetId(ps.length === 1 ? ps[0].id : undefined);
                        setValorEditado(null);
                      }}
                      className="tap flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <span>
                        <span className="block text-[15px] font-medium">{t.nome}</span>
                        <span className="block text-[12.5px] text-muted">
                          {petsDoTutor(db, t.id).map((p) => p.nome).join(", ") || "Sem pets"} · {telefone(t.whatsapp)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {resultados.length === 0 && <li className="px-4 py-3 text-[14px] text-muted">Ninguém encontrado.</li>}
              </ul>
              <button onClick={() => setNovoTutor(true)} className="mt-3 flex items-center gap-2 text-[14.5px] font-medium text-brand-600">
                <UserPlus className="h-[18px] w-[18px]" />
                Adicionar tutor rápido
              </button>
            </>
          )}
        </Bloco>

        {/* 2. Pet */}
        {tutor && (
          <Bloco n={2} titulo="Pet">
            {!novoPet && (
              <div className="flex flex-wrap gap-2">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPetId(p.id);
                      setValorEditado(null);
                    }}
                    className={cx(
                      "tap flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-[14.5px] font-medium",
                      p.id === petId ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line",
                    )}
                  >
                    <PetAvatar pet={p} tamanho={32} />
                    {p.nome}
                    <span className="text-[12px] font-normal text-muted">{p.porte}</span>
                  </button>
                ))}
                <button onClick={() => setNovoPet(true)} className="tap flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 px-4 py-2 text-[14px] font-medium text-brand-600">
                  <Plus className="h-4 w-4" />
                  Novo pet
                </button>
              </div>
            )}
            {novoPet && (
              <div className="space-y-3 rounded-2xl border border-line p-4">
                <input className="input" placeholder="Nome do pet" value={pNome} onChange={(e) => setPNome(e.target.value)} />
                <input className="input" placeholder="Raça (ou SRD)" value={pRaca} onChange={(e) => setPRaca(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  {(["cao", "gato"] as Especie[]).map((e) => (
                    <button key={e} onClick={() => setPEspecie(e)} className={cx("tap rounded-xl border py-2.5 text-[14px] font-medium", pEspecie === e ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}>
                      {e === "cao" ? "Cão" : "Gato"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(["P", "M", "G", "GG"] as Porte[]).map((pt) => (
                    <button key={pt} onClick={() => setPPorte(pt)} className={cx("tap rounded-xl border py-2.5 text-[14px] font-medium", pPorte === pt ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}>
                      {pt}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Botao variante="fantasma" className="h-11" onClick={() => setNovoPet(false)}>
                    Voltar
                  </Botao>
                  <Botao
                    className="h-11"
                    onClick={() => {
                      const r = criarPet({ tutorId: tutor.id, nome: pNome, raca: pRaca.trim() || "Sem raça definida", porte: pPorte, especie: pEspecie });
                      if (!r.ok) return toast(r.erro, "erro");
                      setPetId(r.valor);
                      setNovoPet(false);
                      setPNome("");
                      setPRaca("");
                    }}
                  >
                    Salvar pet
                  </Botao>
                </div>
              </div>
            )}
            {pet && (pet.alergias || pet.cuidados) && (
              <Aviso className="mt-3" icone={<TriangleAlert className="h-5 w-5" />} titulo={pet.alergias ? `Alergia a ${pet.alergias}` : "Cuidado especial"} texto={pet.cuidados} />
            )}
          </Bloco>
        )}

        {/* 3. Serviços */}
        {pet && (
          <Bloco n={3} titulo="Serviços" dica={NOME_PORTE[pet.porte]}>
            {plano && (
              <Aviso
                tom="ok"
                className="mb-3"
                icone={<Info className="h-5 w-5" />}
                titulo={`Plano ativo: ${saldoPlano(db, plano.id)} de ${plano.totalUsos} disponíveis`}
                texto="Um serviço coberto sai sem cobrança e desconta 1 uso ao finalizar."
              />
            )}
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {db.servicos
                .filter((s) => s.ativo)
                .map((s) => {
                  const on = servicoIds.includes(s.id);
                  const { preco, duracaoMin } = s.precos[pet.porte];
                  const coberto = montagem?.itens.find((i) => i.servicoId === s.id)?.cobertoPorPlano;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => {
                          setServicoIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]));
                          setValorEditado(null);
                        }}
                        className="tap flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-lg border-[1.5px]", on ? "border-brand-600 bg-brand-600 text-white" : "border-line")}>
                          {on && <Check className="h-4 w-4" strokeWidth={3} />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-[15px] font-medium">{s.nome}</span>
                          <span className="block text-[12.5px] text-muted">{duracao(duracaoMin)}</span>
                        </span>
                        {coberto ? (
                          <span className="text-[13px] font-semibold text-ok-700">Plano</span>
                        ) : (
                          <span className="text-[14.5px] font-semibold">{moeda(preco)}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </Bloco>
        )}

        {/* 4. Quando */}
        {montagem && (
          <Bloco n={4} titulo="Quando e com quem" dica={`Duração ${duracao(montagem.duracaoMin)}`}>
            <div className="mb-3 flex flex-wrap gap-2">
              {banhistas.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setProfId(m.id)}
                  className={cx("tap rounded-full border px-4 py-2 text-[14px] font-medium", m.id === profId ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}
                >
                  {m.nome.split(" ")[0]}
                </button>
              ))}
            </div>
            <Campo rotulo="Data">
              <input
                type="date"
                className="input"
                value={data}
                min={hoje()}
                onChange={(e) => {
                  setData(e.target.value);
                  setHora("");
                }}
              />
            </Campo>
            <p className="label mt-4">Horário livre</p>
            {!petshopAberto(db, data) ? (
              <p className="rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted">O pet shop não abre neste dia.</p>
            ) : livres.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted">Sem horário livre para este profissional. Tente outro dia ou profissional.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {livres.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHora(h)}
                    className={cx("tap rounded-xl border py-2.5 text-[14px] font-medium tabular-nums", h === horaValida ? "border-brand-600 bg-brand-600 text-white" : "border-line")}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </Bloco>
        )}

        {/* 5. Valor */}
        {montagem && (
          <Bloco n={5} titulo="Valor e observações">
            <Campo rotulo="Valor cobrado (R$)" dica={valorEditado !== null && valor !== montagem.valorSugerido ? `Sugerido: ${moeda(montagem.valorSugerido)}` : "Calculado pelo porte. Pode editar."}>
              <input
                className="input text-[17px] font-semibold"
                inputMode="decimal"
                value={valorEditado ?? String(montagem.valorSugerido)}
                onChange={(e) => setValorEditado(e.target.value)}
              />
            </Campo>
            <div className="mt-4">
              <Campo rotulo="Observações (opcional)">
                <textarea className="input resize-none" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: tutor busca às 12h" />
              </Campo>
            </div>
          </Bloco>
        )}

        <Botao onClick={salvar} disabled={!pet || !horaValida}>
          {pet && horaValida ? `Agendar ${pet.nome} · ${horaValida}` : "Agendar"}
        </Botao>
      </div>
    </div>
  );
}

function Bloco({ n, titulo, dica, children }: { n: number; titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-[12.5px] font-bold text-brand-700">{n}</span>
        <h2 className="flex-1 text-[16px] font-semibold">{titulo}</h2>
        {dica && <span className="text-[13px] text-muted">{dica}</span>}
      </div>
      {children}
    </section>
  );
}
