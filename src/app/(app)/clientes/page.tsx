"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search, TriangleAlert, UserPlus, Users } from "lucide-react";
import { useDb } from "@/data/store";
import { clientesSumidos, petsDoTutor, planoAtivoDoPet } from "@/domain/rules";
import { hoje, telefone } from "@/domain/format";
import { Chip, Filtros, PetAvatar, Titulo, Vazio } from "@/components/ui";

type Filtro = "todos" | "plano" | "alerta" | "sumidos";

export default function Clientes() {
  const db = useDb();
  const T = hoje();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const sumidos = useMemo(() => new Set(clientesSumidos(db, T).map((c) => c.tutor.id)), [db, T]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const dig = q.replace(/\D/g, "");
    return db.tutores
      .filter((t) => {
        const pets = petsDoTutor(db, t.id);
        if (q && !(t.nome.toLowerCase().includes(q) || (dig.length >= 3 && t.whatsapp.includes(dig)) || pets.some((p) => p.nome.toLowerCase().includes(q)))) return false;
        if (filtro === "plano") return pets.some((p) => planoAtivoDoPet(db, p.id, T));
        if (filtro === "alerta") return pets.some((p) => p.alergias || p.cuidados);
        if (filtro === "sumidos") return sumidos.has(t.id);
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [db, busca, filtro, sumidos, T]);

  return (
    <div>
      <Titulo
        acao={
          <Link href="/clientes/novo" className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <UserPlus className="h-[18px] w-[18px]" />
            Novo
          </Link>
        }
      >
        Clientes
      </Titulo>
      <div className="px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
          <input className="input bg-surface pl-11" placeholder="Buscar por tutor, WhatsApp ou pet" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="mt-3">
          <Filtros
            valor={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: "todos", rotulo: "Todos", contagem: db.tutores.length },
              { valor: "plano", rotulo: "Com plano" },
              { valor: "alerta", rotulo: "Com alerta" },
              { valor: "sumidos", rotulo: "Sumidos", contagem: sumidos.size },
            ]}
          />
        </div>
      </div>

      {lista.length === 0 ? (
        <Vazio icone={<Users className="h-6 w-6" />} titulo="Nenhum cliente encontrado" texto="Tente outro nome ou cadastre um novo tutor." />
      ) : (
        <ul className="mt-4 space-y-2.5 px-5">
          {lista.map((t) => {
            const pets = petsDoTutor(db, t.id);
            const alerta = pets.some((p) => p.alergias || p.cuidados);
            const comPlano = pets.some((p) => planoAtivoDoPet(db, p.id, T));
            return (
              <li key={t.id}>
                <Link href={`/clientes/${t.id}`} className="tap card flex items-center gap-3 px-4 py-3.5">
                  <div className="flex -space-x-3">
                    {pets.slice(0, 2).map((p) => (
                      <span key={p.id} className="rounded-full ring-2 ring-white">
                        <PetAvatar pet={p} tamanho={42} />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold">{t.nome}</p>
                    <p className="truncate text-[13px] text-muted">
                      {pets.map((p) => p.nome).join(", ") || "Sem pets"} · {telefone(t.whatsapp)}
                    </p>
                    {(alerta || comPlano || sumidos.has(t.id)) && (
                      <div className="mt-1.5 flex gap-1.5">
                        {alerta && (
                          <Chip tom="warn">
                            <TriangleAlert className="mr-1 h-3 w-3" />
                            Alerta
                          </Chip>
                        )}
                        {comPlano && <Chip tom="info">Plano ativo</Chip>}
                        {sumidos.has(t.id) && <Chip tom="neutral">Sumido</Chip>}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
