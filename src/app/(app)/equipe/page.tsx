"use client";

import { MARCA } from "@/lib/marca";
import { useEffect, useState } from "react";
import { Copy, KeyRound, MessageCircle, Pencil, UserPlus } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Membro } from "@/domain/types";
import { atendimentosDoDia } from "@/domain/rules";
import { NOME_PAPEL } from "@/domain/permissoes";
import { dataCurta, dataDoIso, hoje, iniciais } from "@/domain/format";
import { Aviso, Botao, Campo, Chip, Folha, TituloVoltar, cx } from "@/components/ui";
import { useToast } from "@/components/providers";

export default function Equipe() {
  const db = useDb();
  const modo = useApp((s) => s.modo);
  const [novo, setNovo] = useState(false);
  const [convidando, setConvidando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const doDia = atendimentosDoDia(db, hoje()).filter((a) => a.status !== "cancelado");
  const agora = new Date().toISOString();

  return (
    <div>
      <TituloVoltar
        voltarPara="/mais"
        acao={
          <button onClick={() => setNovo(true)} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <UserPlus className="h-[18px] w-[18px]" />
            Adicionar
          </button>
        }
      >
        Equipe
      </TituloVoltar>
      <ul className="mt-2 space-y-2.5 px-5">
        {[...db.membros].sort((a, b) => Number(b.ativo) - Number(a.ativo)).map((m) => {
          const meus = doDia.filter((a) => a.profissionalId === m.id);
          const feitos = meus.filter((a) => a.status === "finalizado").length;
          const conviteValido = m.convite && m.convite.expiraEm > agora;
          return (
            <li key={m.id} className={cx("card px-4 py-3.5", !m.ativo && "opacity-60")}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-100 text-[14px] font-bold text-brand-700">{iniciais(m.nome)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.nome}
                    {m.id === db.usuarioAtualId && <span className="ml-1.5 text-[12.5px] font-normal text-muted">(você)</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {NOME_PAPEL[m.papel]}
                    {(m.papel === "banhista" || m.papel === "dono") &&
                      (m.semComissao ? " · sem comissão" : m.comissaoPct > 0 ? ` · comissão própria ${m.comissaoPct}%` : m.papel === "banhista" ? " · comissão da tabela" : "")}
                  </p>
                </div>
                {!m.ativo ? (
                  <Chip tom="neutral">Inativo</Chip>
                ) : (
                  m.papel !== "recepcao" &&
                  meus.length > 0 && (
                    <Chip tom="brand">
                      {feitos}/{meus.length} hoje
                    </Chip>
                  )
                )}
                <button aria-label={`Editar ${m.nome}`} onClick={() => setEditando(m.id)} className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand-600 hover:bg-surface">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {m.ativo && !m.temConta && (
                <button
                  onClick={() => setConvidando(m.id)}
                  className={cx(
                    "tap mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium",
                    conviteValido ? "bg-surface text-ink/80" : "bg-brand-50 text-brand-700",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-brand-600" />
                    {conviteValido ? `Convite enviado · código ${m.convite!.codigo}` : "Ainda não entra no app · convidar"}
                  </span>
                  <span className="text-brand-600">{conviteValido ? "Ver" : "Convidar"}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 px-5 text-[13px] leading-snug text-muted">
        Cada pessoa entra com o próprio login e vê só o que usa: banhistas e tosadores veem a própria fila e a ficha dos pets; o motorista vê as rotas do leva e
        traz e compartilha a localização com o tutor; a recepção cuida da agenda, dos clientes e do caixa, sem mexer na equipe nem nas configurações.
        {modo === "demo" && " Na demonstração, troque de pessoa em Mais › Ver o app como."}
      </p>
      <NovoMembro
        aberta={novo}
        onFechar={() => setNovo(false)}
        onCriado={(id) => {
          setNovo(false);
          setConvidando(id);
        }}
      />
      {convidando && <ConviteFolha membroId={convidando} onFechar={() => setConvidando(null)} />}
      <EditarMembroFolha membroId={editando} onFechar={() => setEditando(null)} />
    </div>
  );
}

function EditarMembroFolha({ membroId, onFechar }: { membroId: string | null; onFechar: () => void }) {
  const db = useDb();
  const editar = useApp((s) => s.editarMembro);
  const toast = useToast();
  const m = db.membros.find((x) => x.id === membroId);
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Membro["papel"]>("banhista");
  const [comissao, setComissao] = useState("");
  const [semComissao, setSemComissao] = useState(false);

  useEffect(() => {
    if (!m) return;
    setNome(m.nome);
    setPapel(m.papel);
    setComissao(m.comissaoPct > 0 ? String(m.comissaoPct).replace(".", ",") : "");
    setSemComissao(!!m.semComissao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membroId]);

  if (!m) return null;
  const sou = m.id === db.usuarioAtualId;
  const atende = papel === "banhista" || papel === "dono";

  function salvar(extra: { ativo?: boolean } = {}) {
    const r = editar(m!.id, {
      nome,
      papel,
      comissaoPct: atende ? Number(comissao.replace(",", ".")) || 0 : 0,
      semComissao: atende && semComissao,
      ...extra,
    });
    if (!r.ok) return toast(r.erro, "erro");
    toast(extra.ativo === false ? `${nome.split(" ")[0]} não entra mais no app` : extra.ativo ? `${nome.split(" ")[0]} voltou para a equipe` : "Dados atualizados");
    onFechar();
  }

  return (
    <Folha aberta onFechar={onFechar} titulo={`Editar ${m.nome.split(" ")[0]}`}>
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <div>
          <span className="label">Função</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(["dono", "recepcao", "banhista", "motorista"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={sou && m.papel === "dono" && p !== "dono"}
                onClick={() => setPapel(p)}
                className={cx(
                  "tap rounded-xl border px-1 py-2.5 text-[12.5px] font-medium disabled:opacity-40",
                  papel === p ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted",
                )}
              >
                {p === "banhista" ? "Banhista" : NOME_PAPEL[p]}
              </button>
            ))}
          </div>
          {papel === "dono" && m.papel !== "dono" && <p className="mt-1.5 text-[12.5px] text-warn-700">Dono vê tudo, inclusive dinheiro, equipe e assinatura.</p>}
        </div>
        {atende && (
          <>
            <Campo rotulo="Comissão própria (%)" dica="Vazio = usa a % de cada serviço. A % própria vale para todos os serviços.">
              <input className="input" inputMode="decimal" disabled={semComissao} value={comissao} onChange={(e) => setComissao(e.target.value)} placeholder="Tabela de serviços" />
            </Campo>
            <label className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px]">
              <input type="checkbox" checked={semComissao} onChange={(e) => setSemComissao(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
              <span>
                Não recebe comissão
                <span className="block text-[12.5px] text-muted">Ex.: o dono que também dá banho. Os atendimentos dele não entram no extrato de comissões.</span>
              </span>
            </label>
          </>
        )}
      </div>
      <Botao className="mt-5" onClick={() => salvar()}>
        Salvar
      </Botao>
      {!sou && (
        <button onClick={() => salvar({ ativo: !m.ativo })} className={cx("mx-auto mt-4 block text-[14px] font-medium", m.ativo ? "text-bad-700" : "text-brand-600")}>
          {m.ativo ? "Desativar: não entra mais no app" : "Reativar na equipe"}
        </button>
      )}
    </Folha>
  );
}

function NovoMembro({ aberta, onFechar, onCriado }: { aberta: boolean; onFechar: () => void; onCriado: (id: string) => void }) {
  const criar = useApp((s) => s.criarMembro);
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Membro["papel"]>("banhista");
  const [comissao, setComissao] = useState("");
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Adicionar à equipe">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const r = criar({ nome, papel, comissaoPct: papel === "banhista" ? Number(comissao.replace(",", ".")) || 0 : 0 });
          if (!r.ok) return toast(r.erro, "erro");
          toast(`${nome.trim()} entrou na equipe`);
          setNome("");
          setComissao("");
          onCriado(r.valor);
        }}
      >
        <Campo rotulo="Nome">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bruno Rocha" />
        </Campo>
        <div>
          <span className="label">Função</span>
          <div className="grid grid-cols-3 gap-2">
            {(["banhista", "recepcao", "motorista"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPapel(p)}
                className={cx("tap rounded-xl border px-1 py-2.5 text-[13.5px] font-medium", papel === p ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
              >
                {p === "banhista" ? "Banhista" : NOME_PAPEL[p]}
              </button>
            ))}
          </div>
        </div>
        {papel === "banhista" && (
          <Campo rotulo="Comissão própria (%) · opcional" dica="Deixe vazio para usar a % de cada serviço, definida em Serviços e preços.">
            <input className="input" inputMode="decimal" value={comissao} onChange={(e) => setComissao(e.target.value)} placeholder="Tabela de serviços" />
          </Campo>
        )}
        <Botao type="submit">Adicionar e convidar</Botao>
      </form>
    </Folha>
  );
}

function ConviteFolha({ membroId, onFechar }: { membroId: string; onFechar: () => void }) {
  const db = useDb();
  const modo = useApp((s) => s.modo);
  const convidar = useApp((s) => s.convidar);
  const toast = useToast();
  const [gerando, setGerando] = useState(false);
  const m = db.membros.find((x) => x.id === membroId);
  if (!m) return null;
  const valido = m.convite && m.convite.expiraEm > new Date().toISOString() ? m.convite : undefined;

  const site = typeof window !== "undefined" ? window.location.origin : "";
  const texto = valido
    ? `Oi, ${m.nome.split(" ")[0]}! Você foi convidado(a) para a equipe do ${db.petshop.nome} no ${MARCA.nome}.\n\n` +
      `1. Abra ${site}/entrar?convite=${valido.codigo}\n2. Crie sua conta com seu e-mail\n3. Use o código ${valido.codigo}\n\nO código vale até ${dataCurta(dataDoIso(valido.expiraEm))}.`
    : "";

  async function gerar() {
    setGerando(true);
    const r = await convidar(m!.id);
    setGerando(false);
    if (!r.ok) toast(r.erro, "erro");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast("Mensagem copiada");
    } catch {
      toast("Não deu para copiar. Selecione o texto e copie.", "erro");
    }
  }

  return (
    <Folha aberta onFechar={onFechar} titulo={`Convidar ${m.nome.split(" ")[0]}`}>
      {m.temConta ? (
        <p className="pb-4 text-[14.5px] text-muted">{m.nome} já entra no app.</p>
      ) : !valido ? (
        <div className="pb-2">
          <p className="text-[14.5px] text-muted">
            Gere um código de convite. {m.nome.split(" ")[0]} cria a conta com o próprio e-mail, digita o código e passa a ver o app como{" "}
            <strong className="font-semibold text-ink">{NOME_PAPEL[m.papel].toLowerCase()}</strong>.
          </p>
          {m.convite && <p className="mt-3 text-[13px] text-warn-700">O código anterior venceu. Gere um novo.</p>}
          <Botao className="mt-5" icone={<KeyRound className="h-5 w-5" />} onClick={gerar} disabled={gerando}>
            {gerando ? "Gerando…" : "Gerar código de convite"}
          </Botao>
        </div>
      ) : (
        <div className="pb-2">
          <div className="rounded-[20px] bg-surface px-4 py-5 text-center">
            <p className="text-[13px] text-muted">Código de convite</p>
            <p className="mt-1 font-mono text-[34px] font-bold tracking-[0.3em] text-brand-700">{valido.codigo}</p>
            <p className="mt-1 text-[12.5px] text-muted">Vale até {dataCurta(dataDoIso(valido.expiraEm))} · uso único</p>
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-line px-4 py-3 font-sans text-[13.5px] leading-relaxed text-ink/85">{texto}</pre>
          {modo === "demo" && (
            <Aviso className="mt-3" tom="info" icone={<KeyRound className="h-5 w-5" />} titulo="Código ilustrativo" texto="Na demonstração o convite não cria acesso de verdade." />
          )}
          <div className="mt-4 space-y-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noreferrer"
              className="tap botao-primario flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold text-white"
            >
              <MessageCircle className="h-5 w-5" />
              Enviar pelo WhatsApp
            </a>
            <Botao variante="contorno" icone={<Copy className="h-5 w-5" />} onClick={copiar}>
              Copiar mensagem
            </Botao>
            <button onClick={gerar} disabled={gerando} className="w-full py-1 text-center text-[13.5px] font-medium text-muted">
              {gerando ? "Gerando…" : "Gerar outro código (o atual deixa de valer)"}
            </button>
          </div>
        </div>
      )}
    </Folha>
  );
}
