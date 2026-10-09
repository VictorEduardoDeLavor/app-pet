"use client";

// Leva e traz: a lista do motorista (e a visão da recepção/dono).
// "Saí para buscar/entregar" liga o GPS do celular e o tutor passa a ver o carro no mapa pelo link.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Car, Check, Clock, ExternalLink, House, LocateFixed, MapPin, MessageCircle, Navigation, Phone, Route, TriangleAlert } from "lucide-react";
import { useApp, useDb, useEu } from "@/data/store";
import type { Atendimento, Etapa } from "@/domain/types";
import { NOME_ETAPA, NOME_STATUS, NOME_TRANSPORTE, emRota, porId, proximaEtapaTransporte, rotasDoDia, ultimaEtapa } from "@/domain/rules";
import { hoje, horaDoIso, primeiroNome, telefone } from "@/domain/format";
import { linkAcompanhamento } from "@/domain/messages";
import { useRastreio, type PontoGps } from "@/lib/rastreio";
import { Aviso, Botao, CapaFoto, Chip, Folha, NumeroVidro, PetAvatar, Vazio, cx } from "@/components/ui";
import { FotoBotao } from "@/components/acompanhamento";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { useToast } from "@/components/providers";

const ACAO: Partial<Record<Etapa, string>> = {
  saiu_para_buscar: "Saí para buscar",
  pet_buscado: "Peguei o pet",
  saiu_para_entregar: "Saí para entregar",
  entregue: "Entreguei em casa",
};

/** Atendimentos que estão "na rua" com esta pessoa (foi ela quem registrou a saída). */
function minhasEmRota(membroId: string) {
  const db = useApp.getState().db;
  return db.atendimentos.filter((a) => emRota(db, a.id) && ultimaEtapa(db, a.id)?.porMembroId === membroId);
}

export default function RotasPagina() {
  const db = useDb();
  const eu = useEu();
  const T = hoje();
  const toast = useToast();
  const registrar = useApp((s) => s.registrarEtapa);
  const enviarPosicao = useApp((s) => s.enviarPosicao);
  const rastreio = useRastreio();
  const [chegada, setChegada] = useState<{ a: Atendimento; etapa: Etapa } | null>(null);
  const [zap, setZap] = useState<Atendimento | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const souMotorista = eu?.papel === "motorista";
  const rotas = rotasDoDia(db, T, souMotorista ? eu?.id : undefined);
  const total = rotas.buscar.length + rotas.entregar.length + rotas.concluidos.length;
  const minhas = eu ? db.atendimentos.filter((a) => emRota(db, a.id) && ultimaEtapa(db, a.id)?.porMembroId === eu.id) : [];

  // Sem pet na rua comigo, o GPS desliga sozinho.
  useEffect(() => {
    if (rastreio.ativo && minhas.length === 0) rastreio.parar();
  }, [rastreio, minhas.length]);

  if (!eu) return null;

  function ligarGps() {
    const membroId = eu!.id;
    rastreio.iniciar((p: PontoGps) => {
      for (const a of minhasEmRota(membroId)) enviarPosicao({ atendimentoId: a.id, ...p });
    });
  }

  async function sair(a: Atendimento, etapa: Etapa) {
    setSalvando(a.id);
    const r = await registrar({ atendimentoId: a.id, etapa });
    setSalvando(null);
    if (!r.ok) return toast(r.erro, "erro");
    if (!rastreio.ativo) ligarGps();
    toast(`Localização ao vivo ligada. ${primeiroNome(porId(db.tutores, a.tutorId)?.nome ?? "O tutor")} já pode ver o carro.`);
    setZap(a);
  }

  return (
    <div>
      <CapaFoto foto="/fotos/boas-vindas.webp" posicao="center 45%" className="mx-5 mt-5">
        <div className="px-5 pb-5 pt-24">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">Leva e traz</p>
          <h1 className="mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-white">{souMotorista ? `Boa rota, ${primeiroNome(eu.nome)}!` : "Rotas de hoje"}</h1>
          <div className="mt-5 flex gap-2">
            <NumeroVidro valor={String(rotas.buscar.length)} rotulo="Para buscar" />
            <NumeroVidro valor={String(rotas.entregar.length)} rotulo="Para entregar" />
            <NumeroVidro valor={String(rotas.concluidos.length)} rotulo="Concluídos" />
          </div>
        </div>
      </CapaFoto>

      {/* GPS */}
      {rastreio.ativo ? (
        <div className="mx-5 mt-4 rounded-[20px] border border-ok-500/25 bg-ok-50 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ok-500 text-white">
              <LocateFixed className="h-5 w-5 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ok-700">Localização ao vivo</p>
              <p className="text-[12.5px] text-ok-700/80">
                {rastreio.ultima ? `Última posição às ${horaDoIso(rastreio.ultima.em)} · precisão de ${rastreio.ultima.precisao} m` : "Procurando o GPS…"}
              </p>
            </div>
            <button onClick={() => rastreio.parar()} className="tap shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-bad-700">
              Parar
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-ok-700/80">Deixe o app aberto durante a viagem. O GPS desliga sozinho quando você registrar a chegada.</p>
          {rastreio.erro && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[12.5px] font-medium text-bad-700">{rastreio.erro}</p>}
        </div>
      ) : minhas.length > 0 ? (
        <div className="mx-5 mt-4">
          <Aviso
            icone={<TriangleAlert className="h-5 w-5" />}
            titulo={`Você está na rua com ${minhas.map((a) => porId(db.pets, a.petId)?.nome).join(" e ")}`}
            texto="O GPS foi desligado (o app fechou ou você tocou em parar). Ligue de novo para o tutor continuar vendo o carro."
          />
          <Botao className="mt-3" icone={<LocateFixed className="h-5 w-5" />} onClick={ligarGps}>
            Ligar localização de novo
          </Botao>
        </div>
      ) : null}

      {total === 0 ? (
        <div className="mt-6">
          <Vazio
            icone={<Car className="h-6 w-6" />}
            titulo="Nenhum leva e traz hoje"
            texto={souMotorista ? "Quando a recepção marcar uma busca ou entrega com você, ela aparece aqui." : "Marque “Buscar em casa” ou “Levar para casa” ao agendar."}
          />
        </div>
      ) : (
        <>
          <Bloco titulo="Para buscar" itens={rotas.buscar}>
            {(a) => <CartaoRota key={a.id} a={a} mostrarMotorista={!souMotorista} salvando={salvando === a.id} onSair={sair} onChegar={(etapa) => setChegada({ a, etapa })} onZap={() => setZap(a)} />}
          </Bloco>
          <Bloco titulo="Para entregar" itens={rotas.entregar}>
            {(a) => <CartaoRota key={a.id} a={a} mostrarMotorista={!souMotorista} salvando={salvando === a.id} onSair={sair} onChegar={(etapa) => setChegada({ a, etapa })} onZap={() => setZap(a)} />}
          </Bloco>
          {rotas.concluidos.length > 0 && (
            <section className="mt-6 px-5">
              <h2 className="mb-3 text-[17px] font-semibold">Concluídos</h2>
              <ul className="card divide-y divide-line">
                {rotas.concluidos.map((a) => {
                  const pet = porId(db.pets, a.petId)!;
                  const fim = ultimaEtapa(db, a.id);
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
                      <PetAvatar pet={pet} tamanho={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{pet.nome}</p>
                        <p className="truncate text-[12.5px] text-muted">
                          {fim ? `${NOME_ETAPA[fim.etapa]} às ${horaDoIso(fim.em)}` : NOME_TRANSPORTE[a.transporte]}
                        </p>
                      </div>
                      <Check className="h-5 w-5 shrink-0 text-ok-500" />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <ChegadaFolha
        alvo={chegada}
        onFechar={() => setChegada(null)}
        onFeito={(a) => {
          setChegada(null);
          // Se este era o único pet na rua comigo, o efeito acima desliga o GPS.
          if (rastreio.ativo && minhasEmRota(eu.id).every((x) => x.id === a.id)) rastreio.parar();
        }}
      />
      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={zap.tutorId} atendimentoId={zap.id} gatilho="acompanhamento" />}
    </div>
  );
}

function Bloco({ titulo, itens, children }: { titulo: string; itens: Atendimento[]; children: (a: Atendimento) => ReactNode }) {
  if (itens.length === 0) return null;
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 text-[17px] font-semibold">{titulo}</h2>
      <div className="space-y-3">{itens.map(children)}</div>
    </section>
  );
}

function CartaoRota({
  a,
  mostrarMotorista,
  salvando,
  onSair,
  onChegar,
  onZap,
}: {
  a: Atendimento;
  mostrarMotorista: boolean;
  salvando: boolean;
  onSair: (a: Atendimento, etapa: Etapa) => void;
  onChegar: (etapa: Etapa) => void;
  onZap: () => void;
}) {
  const db = useDb();
  const pet = porId(db.pets, a.petId)!;
  const tutor = porId(db.tutores, a.tutorId);
  const motorista = porId(db.membros, a.motoristaId);
  const prox = proximaEtapaTransporte(db, a);
  const naRua = emRota(db, a.id);
  const destino = a.enderecoTransporte ?? "";
  const ultima = ultimaEtapa(db, a.id);

  return (
    <article className={cx("overflow-hidden rounded-[20px] border bg-white", naRua ? "border-ok-500/40 shadow-[var(--shadow-card)]" : "border-line")}>
      <div className={cx("flex items-center justify-between gap-2 px-4 py-2.5", naRua ? "bg-ok-50" : "bg-surface/70")}>
        <p className="flex items-center gap-1.5 text-[14px] font-semibold tabular-nums">
          <Clock className="h-4 w-4 text-brand-600" />
          {a.hora}
          <span className="font-normal text-muted">· {NOME_TRANSPORTE[a.transporte]}</span>
        </p>
        {naRua ? <Chip tom="ok">Na rua</Chip> : ultima ? <Chip tom="neutral">{NOME_ETAPA[ultima.etapa]}</Chip> : <Chip tom="info">{NOME_STATUS[a.status]}</Chip>}
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <PetAvatar pet={pet} tamanho={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-bold tracking-tight">{pet.nome}</p>
            <p className="truncate text-[13.5px] text-muted">
              {tutor?.nome}
              {pet.temperamento && ` · ${pet.temperamento}`}
            </p>
            {mostrarMotorista && <p className="truncate text-[12.5px] text-subtle">Motorista: {motorista ? primeiroNome(motorista.nome) : "a definir"}</p>}
          </div>
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`}
          target="_blank"
          rel="noreferrer"
          className="tap mt-3 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-[14px]"
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">{destino}</span>
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        </a>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`} target="_blank" rel="noreferrer" className="tap flex flex-col items-center gap-1 rounded-xl border border-line py-2 text-[12px] font-medium text-ink/80">
            <Route className="h-[18px] w-[18px] text-brand-600" />
            Rota
          </a>
          {tutor && (
            <a href={`tel:+${tutor.whatsapp}`} className="tap flex flex-col items-center gap-1 rounded-xl border border-line py-2 text-[12px] font-medium text-ink/80">
              <Phone className="h-[18px] w-[18px] text-brand-600" />
              {telefone(tutor.whatsapp).replace(/^\(\d+\) /, "")}
            </a>
          )}
          <button onClick={onZap} className="tap flex flex-col items-center gap-1 rounded-xl border border-line py-2 text-[12px] font-medium text-ink/80">
            <MessageCircle className="h-[18px] w-[18px] text-ok-500" />
            Avisar
          </button>
        </div>

        {(pet.cuidados || pet.alergias) && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-50 px-3 py-2 text-[13px] font-medium text-warn-700">
            <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
            {pet.cuidados ?? `Alergia a ${pet.alergias}`}
          </p>
        )}

        <div className="mt-4">
          {prox === "saiu_para_buscar" || prox === "saiu_para_entregar" ? (
            <Botao icone={<Car className="h-5 w-5" />} disabled={salvando} onClick={() => onSair(a, prox)}>
              {salvando ? "Registrando…" : ACAO[prox]}
            </Botao>
          ) : prox === "pet_buscado" || prox === "entregue" ? (
            <Botao icone={prox === "entregue" ? <House className="h-5 w-5" /> : <Check className="h-5 w-5" />} onClick={() => onChegar(prox)}>
              {prox === "pet_buscado" ? `Peguei ${pet.nome}` : `Entreguei ${pet.nome}`}
            </Botao>
          ) : (
            <p className="rounded-xl bg-surface px-3 py-2.5 text-center text-[13.5px] text-muted">
              {a.status === "finalizado" ? "Tudo certo por aqui." : `Aguardando o banho terminar (${NOME_STATUS[a.status].toLowerCase()}).`}
            </p>
          )}
        </div>

        {!mostrarMotorista ? null : (
          <Link href={linkAcompanhamento(a)} target="_blank" className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-medium text-brand-600">
            <ExternalLink className="h-3.5 w-3.5" />
            Ver o que o tutor vê
          </Link>
        )}
      </div>
    </article>
  );
}

function ChegadaFolha({ alvo, onFechar, onFeito }: { alvo: { a: Atendimento; etapa: Etapa } | null; onFechar: () => void; onFeito: (a: Atendimento) => void }) {
  const db = useDb();
  const registrar = useApp((s) => s.registrarEtapa);
  const toast = useToast();
  const [foto, setFoto] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    setFoto(null);
    setNota("");
  }, [alvo]);
  if (!alvo) return null;
  const pet = porId(db.pets, alvo.a.petId)!;
  const buscar = alvo.etapa === "pet_buscado";

  async function confirmar() {
    if (!alvo) return;
    setEnviando(true);
    const r = await registrar({ atendimentoId: alvo.a.id, etapa: alvo.etapa, nota, foto });
    setEnviando(false);
    if (!r.ok) return toast(r.erro, "erro");
    toast(buscar ? `${pet.nome} a bordo! Bom caminho até o pet shop.` : `${pet.nome} entregue. Obrigado!`);
    onFeito(alvo.a);
  }

  return (
    <Folha aberta onFechar={onFechar} titulo={buscar ? `${pet.nome} está no carro?` : `${pet.nome} chegou em casa?`}>
      <p className="-mt-1 mb-4 text-[14px] text-muted">
        {buscar ? "Uma foto no carro deixa o tutor tranquilo." : "Uma foto na porta de casa fecha o dia com chave de ouro."} O GPS desliga em seguida.
      </p>
      <FotoBotao foto={foto} onFoto={setFoto} rotulo={buscar ? "Foto no carro" : "Foto da entrega"} />
      <input className="input mt-3" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Recado (opcional)" maxLength={140} />
      <Botao className="mt-5" icone={<Check className="h-5 w-5" />} disabled={enviando} onClick={confirmar}>
        {enviando ? (foto ? "Enviando a foto…" : "Salvando…") : buscar ? `Sim, peguei ${pet.nome}` : `Sim, entreguei ${pet.nome}`}
      </Botao>
    </Folha>
  );
}
