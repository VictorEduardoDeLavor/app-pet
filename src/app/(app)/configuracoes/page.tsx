"use client";

// Dados do pet shop: contato, funcionamento, regras, agendamento online com sinal por Pix e cartão fidelidade.

import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, Copy, ExternalLink, Gift, Globe, MessageCircle, QrCode, Store } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Petshop } from "@/domain/types";
import { NOME_CHAVE, normalizarChavePix } from "@/domain/pix";
import { slugDoNome } from "@/domain/edicao";
import { linkAgendar } from "@/domain/messages";
import { servicosQueContam } from "@/domain/fidelidade";
import { telefone } from "@/domain/format";
import { Aviso, Botao, Campo, TituloVoltar, cx } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAssinatura } from "@/data/assinatura";
import { liberadoPorDatas } from "@/domain/assinatura";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Configuracoes() {
  const db = useDb();
  const ps = db.petshop;
  return (
    <div>
      <TituloVoltar voltarPara="/mais">Dados do pet shop</TituloVoltar>
      <div className="space-y-5 px-5 pb-6 pt-2">
        <Dados ps={ps} />
        <Funcionamento ps={ps} />
        <AgendamentoOnline ps={ps} />
        <Fidelidade ps={ps} />
      </div>
    </div>
  );
}

function Bloco({ icone, titulo, children, sub, id }: { icone: ReactNode; titulo: string; sub?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[22px] border border-line px-4 py-4">
      <h2 className="flex items-center gap-2 text-[16.5px] font-semibold">
        <span className="text-brand-600 [&>svg]:h-5 [&>svg]:w-5">{icone}</span>
        {titulo}
      </h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function useSalvar() {
  const atualizar = useApp((s) => s.atualizarPetshop);
  const toast = useToast();
  return (dados: Partial<Petshop>, msg = "Salvo") => {
    const r = atualizar(dados);
    if (!r.ok) {
      toast(r.erro, "erro");
      return false;
    }
    toast(msg);
    return true;
  };
}

function Dados({ ps }: { ps: Petshop }) {
  const salvar = useSalvar();
  const [nome, setNome] = useState(ps.nome);
  const [zap, setZap] = useState(ps.whatsapp ? telefone(ps.whatsapp) : "");
  const [endereco, setEndereco] = useState(ps.endereco ?? "");
  useEffect(() => {
    setNome(ps.nome);
    setZap(ps.whatsapp ? telefone(ps.whatsapp) : "");
    setEndereco(ps.endereco ?? "");
    // Só quando outro aparelho muda os dados (o id não muda); edição local não é sobrescrita enquanto digita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ps.id]);
  const mudou = nome !== ps.nome || zap.replace(/\D/g, "") !== (ps.whatsapp ? telefone(ps.whatsapp).replace(/\D/g, "") : "") || endereco !== (ps.endereco ?? "");
  return (
    <Bloco icone={<Store />} titulo="Contato" sub="Aparece para o tutor no link de acompanhamento e na página de agendamento.">
      <Campo rotulo="Nome do pet shop">
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Campo rotulo="WhatsApp do pet shop">
        <input className="input" inputMode="tel" value={zap} onChange={(e) => setZap(e.target.value)} placeholder="(11) 97520-1421" />
      </Campo>
      <Campo rotulo="Endereço">
        <input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número · bairro, cidade" />
      </Campo>
      <Botao variante={mudou ? "primario" : "contorno"} disabled={!mudou} onClick={() => salvar({ nome, whatsapp: zap, endereco }, "Contato atualizado")}>
        Salvar contato
      </Botao>
    </Bloco>
  );
}

function Funcionamento({ ps }: { ps: Petshop }) {
  const salvar = useSalvar();
  const [abre, setAbre] = useState(ps.abre);
  const [fecha, setFecha] = useState(ps.fecha);
  return (
    <Bloco icone={<CalendarClock />} titulo="Funcionamento e regras">
      <div>
        <span className="label">Dias abertos</span>
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS.map((d, i) => {
            const on = ps.diasAbertos.includes(i);
            return (
              <button
                key={d}
                onClick={() => salvar({ diasAbertos: on ? ps.diasAbertos.filter((x) => x !== i) : [...ps.diasAbertos, i] }, on ? `${d}: fechado` : `${d}: aberto`)}
                className={cx("tap rounded-xl py-2 text-[12.5px] font-medium", on ? "bg-brand-600 text-white" : "bg-surface text-muted")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Abre às">
          <input className="input" type="time" step={1800} value={abre} onChange={(e) => setAbre(e.target.value)} />
        </Campo>
        <Campo rotulo="Fecha às">
          <input className="input" type="time" step={1800} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
      </div>
      {(abre !== ps.abre || fecha !== ps.fecha) && (
        <Botao onClick={() => !salvar({ abre, fecha }, "Horário atualizado") && (setAbre(ps.abre), setFecha(ps.fecha))}>Salvar horário</Botao>
      )}
      <label className="flex items-center justify-between gap-3 text-[14.5px]">
        <span>
          Falta consome 1 uso do plano
          <span className="block text-[12.5px] text-muted">Quando o tutor não aparece.</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ps.faltaConsomeUso} onChange={(e) => salvar({ faltaConsomeUso: e.target.checked })} />
      </label>
      <label className="flex items-center justify-between gap-3 text-[14.5px]">
        <span>
          Cliente sumido após
          <span className="block text-[12.5px] text-muted">Dias sem visita para sugerir mensagem.</span>
        </span>
        <select className="rounded-xl border border-line bg-white px-3 py-2 text-[14.5px]" value={ps.diasClienteSumido} onChange={(e) => salvar({ diasClienteSumido: Number(e.target.value) })}>
          {[...new Set([21, 30, 45, 60, 90, ps.diasClienteSumido])].sort((a, b) => a - b).map((d) => (
            <option key={d} value={d}>
              {d} dias
            </option>
          ))}
        </select>
      </label>
    </Bloco>
  );
}

function AgendamentoOnline({ ps }: { ps: Petshop }) {
  const salvar = useSalvar();
  const toast = useToast();
  const modo = useApp((s) => s.modo);
  const liberada = useAssinatura((s) => s.info);
  const [slug, setSlug] = useState(ps.slug);
  const [chave, setChave] = useState(ps.pixChave ?? "");
  const [cidade, setCidade] = useState(ps.pixCidade ?? "");
  const [sinal, setSinal] = useState(ps.sinalPct);
  const link = linkAgendar(ps.slug);
  const pix = chave.trim() ? normalizarChavePix(chave) : null;
  const slugSugerido = slugDoNome(ps.nome);
  const slugFeio = /-[a-z0-9]{4}$/.test(ps.slug) && ps.slug.startsWith(slugSugerido.slice(0, 20));

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copiado");
    } catch {
      toast("Não foi possível copiar", "erro");
    }
  }

  const textoDivulgar = `Agora você pode agendar o banho do seu pet na ${ps.nome} pelo celular, a qualquer hora: ${link}`;

  return (
    <Bloco id="online" icone={<Globe />} titulo="Agendamento online" sub="Uma página do pet shop onde o tutor escolhe serviço, dia e horário sozinho. Os pedidos caem na agenda como “Online”.">
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14.5px] font-medium">
        Página de agendamento ligada
        <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ps.agendamentoOnline} onChange={(e) => salvar({ agendamentoOnline: e.target.checked }, e.target.checked ? "Agendamento online ligado" : "Agendamento online desligado")} />
      </label>

      {ps.agendamentoOnline && (
        <>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
            <p className="text-[12.5px] text-muted">Link para divulgar (Instagram, WhatsApp, Google)</p>
            <p className="mt-0.5 break-all text-[14.5px] font-semibold text-brand-700">{link}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <button onClick={copiar} className="flex items-center gap-1 text-[13.5px] font-medium text-brand-600">
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13.5px] font-medium text-brand-600">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(textoDivulgar)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13.5px] font-medium text-brand-600">
                <MessageCircle className="h-3.5 w-3.5" />
                Divulgar no WhatsApp
              </a>
            </div>
          </div>
          {modo === "nuvem" && liberada && !liberadoPorDatas(liberada) && (
            <Aviso tom="bad" icone={<Globe className="h-5 w-5" />} titulo="A página fica fora do ar enquanto a assinatura estiver bloqueada." />
          )}
          <Campo rotulo="Endereço da página" dica={slugFeio ? `Dica: troque para “${slugSugerido}”, mais fácil de lembrar.` : "Letras minúsculas, números e hífen."}>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[13px] text-muted">/agendar/</span>
              <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
            </div>
          </Campo>
          {slug !== ps.slug && (
            <Botao onClick={() => !salvar({ slug }, "Endereço da página atualizado") && setSlug(ps.slug)}>Salvar endereço (o link antigo para de funcionar)</Botao>
          )}

          <div className="border-t border-line pt-4">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <QrCode className="h-4 w-4 text-brand-600" />
              Sinal por Pix (opcional)
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              Ao agendar, o tutor recebe o Pix copia e cola com o valor do sinal. O dinheiro cai direto na sua conta; a equipe confere no extrato e marca como recebido. Diminui as faltas.
            </p>
          </div>
          <div>
            <span className="label">Sinal pedido</span>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 10, 20, 30, 50].map((v) => (
                <button key={v} type="button" onClick={() => setSinal(v)} className={cx("tap rounded-xl border py-2 text-[13.5px] font-medium", sinal === v ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}>
                  {v === 0 ? "Sem" : `${v}%`}
                </button>
              ))}
            </div>
          </div>
          {sinal > 0 && (
            <>
              <Campo rotulo="Chave Pix que recebe" dica={chave.trim() ? (pix ? `Reconhecida: ${NOME_CHAVE[pix.tipo]} (${pix.chave})` : "Não reconhecemos esta chave. Confira CPF, CNPJ, celular, e-mail ou chave aleatória.") : "CPF, CNPJ, celular, e-mail ou chave aleatória."}>
                <input className="input" value={chave} onChange={(e) => setChave(e.target.value)} autoCapitalize="none" />
              </Campo>
              <Campo rotulo="Cidade da conta">
                <input className="input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: São Paulo" />
              </Campo>
            </>
          )}
          {(sinal !== ps.sinalPct || chave !== (ps.pixChave ?? "") || cidade !== (ps.pixCidade ?? "")) && (
            <Botao
              onClick={() => {
                if (sinal > 0 && !pix) return toast("Confira a chave Pix.", "erro");
                salvar({ sinalPct: sinal, pixChave: sinal > 0 ? pix!.chave : ps.pixChave, pixCidade: cidade }, sinal > 0 ? `Sinal de ${sinal}% ligado` : "Sem sinal no agendamento online");
              }}
            >
              Salvar sinal
            </Botao>
          )}
        </>
      )}
    </Bloco>
  );
}

function Fidelidade({ ps }: { ps: Petshop }) {
  const db = useDb();
  const salvar = useSalvar();
  const [meta, setMeta] = useState(String(ps.fidelidadeMeta));
  const [premio, setPremio] = useState(ps.fidelidadePremio);
  const contam = new Set(servicosQueContam(db).map((s) => s.id));
  const escolhidos = ps.fidelidadeServicoIds;
  return (
    <Bloco id="fidelidade" icone={<Gift />} titulo="Cartão fidelidade" sub="Cada atendimento finalizado com um serviço que conta vira um selo. Completou, ganha o prêmio como desconto. O tutor acompanha os selos pelo link.">
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14.5px] font-medium">
        Cartão fidelidade ligado
        <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ps.fidelidadeAtiva} onChange={(e) => salvar({ fidelidadeAtiva: e.target.checked }, e.target.checked ? "Cartão fidelidade ligado" : "Cartão fidelidade desligado")} />
      </label>
      {ps.fidelidadeAtiva && (
        <>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Campo rotulo="Selos">
              <input className="input" inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value)} />
            </Campo>
            <Campo rotulo="Prêmio">
              <input className="input" value={premio} onChange={(e) => setPremio(e.target.value)} />
            </Campo>
          </div>
          {(meta !== String(ps.fidelidadeMeta) || premio !== ps.fidelidadePremio) && (
            <Botao onClick={() => salvar({ fidelidadeMeta: Number(meta), fidelidadePremio: premio }, "Cartão fidelidade atualizado")}>Salvar cartão</Botao>
          )}
          <div>
            <span className="label">Serviços que contam selo</span>
            <div className="flex flex-wrap gap-2">
              {db.servicos
                .filter((s) => s.ativo)
                .map((s) => {
                  const on = contam.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const base = escolhidos.length ? escolhidos : [...contam];
                        salvar({ fidelidadeServicoIds: on ? base.filter((x) => x !== s.id) : [...base, s.id] });
                      }}
                      className={cx("tap rounded-full border px-3.5 py-2 text-[13.5px] font-medium", on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}
                    >
                      {s.nome}
                    </button>
                  );
                })}
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {escolhidos.length ? "Só os marcados contam." : "Sem escolha: contam os serviços de banho e de tosa."} Atendimentos cobertos por plano não contam.
            </p>
          </div>
        </>
      )}
    </Bloco>
  );
}
