"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Camera, LoaderCircle, PawPrint, Pencil, TriangleAlert, User, X } from "lucide-react";
import { useApp, useDb, usePapel } from "@/data/store";
import { useToast } from "@/components/providers";
import { pode } from "@/domain/permissoes";
import { planoAtivoDoPet, porId, saldoPlano, usosDoPlano } from "@/domain/rules";
import { NOME_PORTE, dataCurta, diferencaDias, hoje, moeda } from "@/domain/format";
import { Aviso, BotaoLink, Chip, PetAvatar, Progresso, Secao, StatusChip, TituloVoltar, Vazio } from "@/components/ui";
import { EditarPetFolha, idade } from "@/components/pet-form";
import { CarteiraSaude } from "@/components/vacinas";
import { CartaoSelos } from "@/components/fidelidade";
import { cartao } from "@/domain/fidelidade";

export default function PetDetalhe() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const T = hoje();
  const papel = usePapel();
  const [editando, setEditando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const salvarFoto = useApp((s) => s.salvarFotoPet);
  const toast = useToast();
  const router = useRouter();
  const pet = porId(db.pets, id);

  if (!pet) {
    return (
      <>
        <TituloVoltar voltarPara={pode(papel, "clientes") ? "/clientes" : "/fila"}>Pet</TituloVoltar>
        <Vazio icone={<PawPrint className="h-6 w-6" />} titulo="Pet não encontrado" />
      </>
    );
  }

  const tutor = porId(db.tutores, pet.tutorId);
  const plano = planoAtivoDoPet(db, pet.id, T);
  const historico = db.atendimentos.filter((a) => a.petId === pet.id).sort((a, b) => (a.data + a.hora < b.data + b.hora ? 1 : -1));
  const ficha: [string, string | undefined][] = [
    ["Espécie", pet.especie === "gato" ? "Gato" : "Cão"],
    ["Sexo", pet.sexo === "F" ? "Fêmea" : pet.sexo === "M" ? "Macho" : undefined],
    ["Idade", pet.nascimento ? `${idade(pet.nascimento)} · nasceu ${dataCurta(pet.nascimento)}` : undefined],
    ["Peso", pet.pesoKg ? `${String(pet.pesoKg).replace(".", ",")} kg` : undefined],
    ["Pelagem", pet.pelagem],
    ["Temperamento", pet.temperamento],
    ["Observações", pet.observacoes],
    ["Última visita", pet.ultimaVisita ? `${dataCurta(pet.ultimaVisita)} (há ${diferencaDias(pet.ultimaVisita, T)} dias)` : undefined],
  ];

  return (
    <div>
      <TituloVoltar
        acao={
          <button onClick={() => setEditando(true)} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        }
      >
        Ficha do pet
      </TituloVoltar>

      <div aria-hidden className="relative mx-5 mt-1 h-28 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-200 via-brand-100 to-brand-50">
        {pet.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.fotoUrl} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-90 blur-2xl saturate-150" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(198_184_251/0.25),rgb(255_255_255/0.35))]" />
      </div>
      <div className="-mt-14 flex flex-col items-center px-5 pb-4 text-center">
        <span className="relative rounded-full bg-white p-1 shadow-[var(--shadow-hero)]">
          <PetAvatar pet={pet} tamanho={100} />
          <label
            aria-label={pet.fotoUrl ? "Trocar foto" : "Adicionar foto"}
            className="tap absolute -bottom-0.5 -right-0.5 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-[3px] border-white bg-brand-600 text-white shadow-md"
          >
            {enviandoFoto ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={enviandoFoto}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setEnviandoFoto(true);
                const r = await salvarFoto(pet.id, f);
                setEnviandoFoto(false);
                toast(r.ok ? `Foto de ${pet.nome} atualizada` : r.erro, r.ok ? "ok" : "erro");
              }}
            />
          </label>
        </span>
        {pet.fotoUrl && !enviandoFoto && (
          <button
            onClick={async () => {
              setEnviandoFoto(true);
              const r = await salvarFoto(pet.id, null);
              setEnviandoFoto(false);
              toast(r.ok ? "Foto removida" : r.erro, r.ok ? "ok" : "erro");
            }}
            className="mt-2 flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-bad-700"
          >
            <X className="h-3.5 w-3.5" />
            Remover foto
          </button>
        )}
        <h2 className="mt-3 text-[24px] font-bold tracking-tight">{pet.nome}</h2>
        <p className="text-[14px] text-muted">
          {pet.raca} · {NOME_PORTE[pet.porte]}
        </p>
        {tutor &&
          (pode(papel, "clientes") ? (
            <Link href={`/clientes/${tutor.id}`} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-brand-700">
              <User className="h-3.5 w-3.5" />
              {tutor.nome}
            </Link>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink/80">
              <User className="h-3.5 w-3.5" />
              {tutor.nome}
            </span>
          ))}
      </div>

      {(pet.alergias || pet.cuidados) && (
        <div className="px-5">
          <Aviso icone={<TriangleAlert className="h-6 w-6 fill-warn-500 text-white" />} titulo={pet.alergias ? `Alergia a ${pet.alergias}` : "Cuidado especial"} texto={pet.cuidados} />
        </div>
      )}

      <dl className="mx-5 mt-4 divide-y divide-line rounded-[20px] border border-line">
        {ficha
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-3 text-[14.5px]">
              <dt className="w-[116px] shrink-0 text-muted">{k}</dt>
              <dd className="flex-1">{v}</dd>
            </div>
          ))}
      </dl>

      {db.petshop.fidelidadeAtiva && (
        <div className="mx-5 mt-4">
          {(() => {
            const c = cartao(db, pet.id);
            return <CartaoSelos meta={c.meta} selos={c.selos} premio={c.premio} nomePet={pet.nome} />;
          })()}
        </div>
      )}

      <CarteiraSaude petId={pet.id} podeAvisar={pode(papel, "mensagens")} />

      <Secao className="mt-6" titulo="Plano">
        {plano ? (
          <div className="card px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{plano.nome}</p>
              <Chip tom="ok">Ativo</Chip>
            </div>
            <p className="mt-2 text-[14px]">
              {saldoPlano(db, plano.id)} de {plano.totalUsos} disponíveis · vence {dataCurta(plano.vencimento)}
            </p>
            <Progresso className="mt-2" valor={saldoPlano(db, plano.id)} total={plano.totalUsos} />
            <p className="mt-2 text-[12.5px] text-muted">
              {usosDoPlano(db, plano.id).length} usos registrados{pode(papel, "financeiro") && ` · pago ${moeda(plano.preco)}`}
            </p>
          </div>
        ) : !pode(papel, "planos") ? (
          <p className="text-[14px] text-muted">Sem plano ativo.</p>
        ) : (
          <Link href={`/planos?vender=${pet.id}`} className="tap flex items-center justify-between rounded-2xl border border-dashed border-brand-300 px-4 py-3.5 text-[14.5px] font-medium text-brand-700">
            Sem plano ativo. Vender um pacote
            <span aria-hidden>→</span>
          </Link>
        )}
      </Secao>

      <Secao className="mt-6" titulo="Atendimentos">
        {historico.length === 0 ? (
          <p className="text-[14px] text-muted">Nenhum atendimento ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {historico.map((a) => (
              <li key={a.id}>
                <Link href={`/atendimentos/${a.id}`} className="tap flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium">
                      {dataCurta(a.data)} · {a.hora}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">{a.itens.map((i) => i.nome).join(" + ")}</p>
                  </div>
                  <StatusChip status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {pode(papel, "agenda") && (
        <div className="px-5 pt-5">
          <BotaoLink href={`/agenda/novo?pet=${pet.id}`} icone={<CalendarPlus className="h-5 w-5" />}>
            Agendar {pet.nome}
          </BotaoLink>
        </div>
      )}

      <EditarPetFolha
        aberta={editando}
        onFechar={() => setEditando(false)}
        pet={pet}
        aoExcluir={pode(papel, "clientes") ? () => router.replace(tutor ? `/clientes/${tutor.id}` : "/clientes") : undefined}
      />
    </div>
  );
}
