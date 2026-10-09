"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, CalendarDays, CalendarPlus, Car, ChevronRight, ClipboardList, Gift, Globe, MessageCircle, PackageOpen, PawPrint, ShoppingBag, Syringe, TriangleAlert, Users } from "lucide-react";
import { useDb, usePapel } from "@/data/store";
import { pedidosOnlinePendentes } from "@/domain/agendamento-online";
import { vacinasVencendo } from "@/domain/vacinas";
import { produtosAbaixoDoMinimo } from "@/domain/produtos";
import { petsComPremio } from "@/domain/fidelidade";
import { pode } from "@/domain/permissoes";
import { atendimentosDoDia, clientesSumidos, emRota, kpisDoDia, planosAVencer, porId, prontosParaAvisar } from "@/domain/rules";
import { dataLonga, diaCurto, hoje, horaAtual, horaDoIso, moeda, moedaCurta, primeiroNome, saudacao } from "@/domain/format";
import { CapaFoto, Chip, Folha, NumeroVidro, Secao, StatusChip, Vazio, PetAvatar } from "@/components/ui";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { FaixaAssinatura } from "@/components/portao";
import { MARCA } from "@/lib/marca";

export default function Inicio() {
  const db = useDb();
  const T = hoje();
  const k = kpisDoDia(db, T);
  const aVencer = planosAVencer(db, T);
  const sumidos = clientesSumidos(db, T);
  const usuario = porId(db.membros, db.usuarioAtualId);
  const proximos = atendimentosDoDia(db, T).filter((a) => ["agendado", "confirmado", "em_atendimento"].includes(a.status));
  const prontos = prontosParaAvisar(db, T);
  const proximo = proximos.find((a) => a.status !== "em_atendimento" && a.hora >= horaAtual());
  const petProximo = proximo ? porId(db.pets, proximo.petId) : undefined;
  const frase = petProximo ? `Próximo: ${petProximo.nome} às ${proximo!.hora}` : proximos.length ? "Tudo andando por aqui." : "Agenda livre por enquanto.";
  const [avisar, setAvisar] = useState<{ tutorId: string; atendimentoId: string } | null>(null);
  const naRua = atendimentosDoDia(db, T).filter((a) => emRota(db, a.id));
  const papel = usePapel();
  const online = pedidosOnlinePendentes(db, T);
  const vacinas = vacinasVencendo(db, T);
  const estoqueBaixo = pode(papel, "produtos") ? produtosAbaixoDoMinimo(db) : [];
  const premios = petsComPremio(db);
  const [avisos, setAvisos] = useState(false);
  const alertas = [
    online.length && { href: online.length === 1 ? `/atendimentos/${online[0].id}` : `/agenda?status=online&data=${online[0].data}`, icone: <Globe />, titulo: `${online.length} ${online.length === 1 ? "pedido online" : "pedidos online"} para confirmar` },
    aVencer.length && { href: "/planos?filtro=vencer", icone: <ClipboardList />, titulo: `${aVencer.length} ${aVencer.length === 1 ? "plano a vencer" : "planos a vencer"}` },
    vacinas.length && { href: "/mensagens", icone: <Syringe />, titulo: `${vacinas.length} ${vacinas.length === 1 ? "vacina vencendo" : "vacinas vencendo"}: avise os tutores` },
    sumidos.length && { href: "/mensagens#sumidos", icone: <Users />, titulo: `${sumidos.length} clientes sumidos` },
    estoqueBaixo.length && { href: "/produtos", icone: <PackageOpen />, titulo: `${estoqueBaixo.length} ${estoqueBaixo.length === 1 ? "produto acabando" : "produtos acabando"}` },
    premios.length && { href: `/pets/${premios[0].petId}`, icone: <Gift />, titulo: `${premios.length} ${premios.length === 1 ? "pet com prêmio" : "pets com prêmio"} de fidelidade para usar` },
  ].filter(Boolean) as { href: string; icone: ReactNode; titulo: string }[];

  return (
    <div>
      <header className="flex items-center justify-between px-5 pt-6 lg:justify-end">
        <div className="flex items-center gap-2.5 lg:hidden">
          <PawPrint className="h-8 w-8 text-brand-600" strokeWidth={2.2} />
          <div className="leading-tight">
            <p className="text-[18px] font-bold tracking-tight text-brand-700">{MARCA.nome}</p>
            <p className="text-[12.5px] text-muted">{db.petshop.nome}</p>
          </div>
        </div>
        <button onClick={() => setAvisos(true)} aria-label={`Avisos (${alertas.length})`} className="tap relative grid h-11 w-11 place-items-center rounded-full hover:bg-surface">
          <Bell className="h-[22px] w-[22px] text-ink" />
          {alertas.length > 0 && (
            <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-bad-500 px-1 text-[10px] font-bold text-white">{alertas.length}</span>
          )}
        </button>
      </header>

      <CapaFoto foto="/fotos/inicio-sofa.webp" posicao="center 35%" className="mx-5 mt-4">
        <div className="px-5 pb-5 pt-24">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">{dataLonga(T)}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-white">
            {saudacao()}, {primeiroNome(usuario?.nome ?? "")}!
          </h1>
          <p className="mt-1.5 text-[14.5px] text-white/85">{frase}</p>
          <div className="mt-5 flex gap-2">
            <NumeroVidro href="/agenda" valor={String(k.agendamentos)} rotulo="Agendamentos" sub="hoje" />
            <NumeroVidro href="/agenda?status=em_atendimento" valor={String(k.emAtendimento)} rotulo="Atendendo" sub="agora" />
            <NumeroVidro href="/financeiro" valor={moedaCurta(k.caixa)} rotulo="Caixa de hoje" />
          </div>
        </div>
      </CapaFoto>

      <FaixaAssinatura className="mx-5 mt-4" />

      {online.length > 0 && (
        <section className="mx-5 mt-4 rounded-[20px] border border-brand-200 bg-brand-50 px-4 py-3.5" aria-label="Pedidos online">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-brand-700">
            <Globe className="h-5 w-5" />
            {online.length === 1 ? "1 pedido online para confirmar" : `${online.length} pedidos online para confirmar`}
          </p>
          <ul className="mt-2.5 space-y-2">
            {online.slice(0, 4).map((a) => {
              const pet = porId(db.pets, a.petId)!;
              const tutor = porId(db.tutores, a.tutorId);
              return (
                <li key={a.id}>
                  <Link href={`/atendimentos/${a.id}`} className="tap flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5">
                    <PetAvatar pet={pet} tamanho={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {pet.nome} <span className="font-normal text-muted">· {tutor ? primeiroNome(tutor.nome) : ""}</span>
                      </p>
                      <p className="truncate text-[12.5px] text-muted">
                        {a.data === T ? "Hoje" : diaCurto(a.data)} {a.data.slice(8)}/{a.data.slice(5, 7)} às {a.hora} · {a.itens.map((i) => i.nome).join(" + ")}
                      </p>
                    </div>
                    {!!a.sinalValor && <Chip tom={a.sinalPago ? "ok" : "warn"}>{a.sinalPago ? "Sinal pago" : `Sinal ${moeda(a.sinalValor)}`}</Chip>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {aVencer.length > 0 && (
        <Link
          href="/planos?filtro=vencer"
          className="tap mx-5 mt-4 flex items-center gap-3 rounded-[18px] border border-warn-100 bg-warn-50 px-4 py-3.5"
        >
          <TriangleAlert className="h-7 w-7 shrink-0 fill-warn-500 text-white" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-warn-700">
              {aVencer.length} {aVencer.length === 1 ? "plano a vencer" : "planos a vencer"}
            </p>
            <p className="text-[13px] leading-snug text-warn-700/80">Confira os planos que estão próximos do vencimento ou do último banho.</p>
          </div>
          <ChevronRight className="h-5 w-5 text-warn-700/70" />
        </Link>
      )}

      {prontos.length > 0 && (
        <section className="mx-5 mt-4 rounded-[20px] border border-ok-500/25 bg-ok-50 px-4 py-3.5" aria-label="Pets prontos">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ok-700">
            <PawPrint className="h-5 w-5" />
            {prontos.length === 1 ? "1 pet pronto para buscar" : `${prontos.length} pets prontos para buscar`}
          </p>
          <ul className="mt-2.5 space-y-2">
            {prontos.map((a) => {
              const pet = porId(db.pets, a.petId)!;
              const tutor = porId(db.tutores, a.tutorId);
              const fim = a.eventos.findLast((e) => e.para === "finalizado")?.em;
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5">
                  <PetAvatar pet={pet} tamanho={40} />
                  <Link href={`/atendimentos/${a.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{pet.nome}</p>
                    <p className="truncate text-[12.5px] text-muted">
                      {fim ? `Pronto às ${horaDoIso(fim)}` : "Pronto"} · {tutor ? primeiroNome(tutor.nome) : ""}
                    </p>
                  </Link>
                  <button
                    onClick={() => setAvisar({ tutorId: a.tutorId, atendimentoId: a.id })}
                    className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-ok-500 px-3.5 py-2 text-[13px] font-semibold text-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Avisar
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
        <Atalho href="/agenda/novo" icone={<CalendarPlus />} rotulo="Novo agendamento" />
        <Atalho href="/clientes" icone={<Users />} rotulo="Clientes" />
        {pode(papel, "produtos") && db.produtos.some((p) => p.ativo) ? (
          <Atalho href="/produtos?vender=1" icone={<ShoppingBag />} rotulo="Vender produto" />
        ) : (
          <Atalho href="/planos" icone={<ClipboardList />} rotulo="Planos" />
        )}
        <Atalho href="/rotas" icone={<Car />} rotulo={naRua.length ? `Leva e traz · ${naRua.length} na rua` : "Leva e traz"} />
      </div>

      <Secao
        className="mt-7"
        titulo="Atendimentos do dia"
        acao={
          <Link href="/agenda" className="text-[14px] font-medium text-brand-600">
            Ver todos
          </Link>
        }
      >
        {proximos.length === 0 ? (
          <div className="card">
            <Vazio foto="/fotos/descanso.webp" icone={<CalendarDays className="h-6 w-6" />} titulo="Nenhum atendimento pendente" texto="Tudo tranquilo por aqui." />
          </div>
        ) : (
          <ul className="card divide-y divide-line">
            {proximos.slice(0, 4).map((a) => {
              const pet = porId(db.pets, a.petId)!;
              const tutor = porId(db.tutores, a.tutorId);
              return (
                <li key={a.id}>
                  <Link href={`/atendimentos/${a.id}`} className="tap flex items-center gap-3 px-3.5 py-3">
                    <PetAvatar pet={pet} tamanho={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[16px] font-semibold">{pet.nome}</p>
                        <StatusChip status={a.status} />
                      </div>
                      <p className="truncate text-[13.5px] text-muted">
                        {a.hora} · {a.itens.map((i) => i.nome).join(" + ")}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13.5px] text-muted">{tutor?.nome}</p>
                        {a.planoPetId && <Chip tom="info">Plano ativo</Chip>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {sumidos.length > 0 && (
        <Link href="/mensagens#sumidos" className="tap mx-5 mt-4 flex items-center gap-3 rounded-[18px] border border-line px-4 py-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Users className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-[14.5px] font-semibold">{sumidos.length} clientes sumidos</p>
            <p className="text-[13px] text-muted">Mais de {db.petshop.diasClienteSumido} dias sem visita. Mande um oi.</p>
          </div>
          <ChevronRight className="h-5 w-5 text-subtle" />
        </Link>
      )}

      <Folha aberta={avisos} onFechar={() => setAvisos(false)} titulo="Avisos">
        {alertas.length === 0 ? (
          <p className="pb-4 text-[14.5px] text-muted">Nada pedindo atenção agora.</p>
        ) : (
          <ul className="space-y-2 pb-2">
            {alertas.map((x) => (
              <li key={x.href + x.titulo}>
                <Link href={x.href} onClick={() => setAvisos(false)} className="tap flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 [&>svg]:h-[18px] [&>svg]:w-[18px]">{x.icone}</span>
                  <span className="flex-1 text-[14.5px] font-medium">{x.titulo}</span>
                  <ChevronRight className="h-5 w-5 text-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Folha>

      {avisar && <WhatsappFolha aberta onFechar={() => setAvisar(null)} tutorId={avisar.tutorId} atendimentoId={avisar.atendimentoId} gatilho="pet_pronto" />}
    </div>
  );
}

function Atalho({ href, icone, rotulo }: { href: string; icone: ReactNode; rotulo: string }) {
  return (
    <Link href={href} className="tap card flex items-center gap-3 px-3 py-3.5 shadow-[var(--shadow-card)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 [&>svg]:h-[21px] [&>svg]:w-[21px]">{icone}</span>
      <span className="flex-1 text-[14px] font-medium leading-tight">{rotulo}</span>
      <ChevronRight className="h-4 w-4 text-subtle" />
    </Link>
  );
}
