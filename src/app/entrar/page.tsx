"use client";

import { useEffect, useState } from "react";
import { KeyRound, MailCheck, PawPrint, Sparkles } from "lucide-react";
import { CHAVE_CONVITE, CHAVE_DEMO, supabase, temSupabase } from "@/lib/supabase/client";
import { Aviso, Botao, Campo, Segmentado } from "@/components/ui";

function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered|already been registered/i.test(msg)) return "Este e-mail já tem conta. Use Entrar.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/unable to validate email|invalid email/i.test(msg)) return "E-mail inválido.";
  return msg;
}

export default function Entrar() {
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [convite, setConvite] = useState<string | null>(null);
  const [esqueci, setEsqueci] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);

  // Link de convite: guarda o código para usar depois do cadastro e já abre em "Criar conta".
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("convite");
    if (!c) return;
    const codigo = c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    localStorage.setItem(CHAVE_CONVITE, codigo);
    setConvite(codigo);
    setModo("criar");
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!temSupabase) return;
    setEnviando(true);
    const sb = supabase();
    try {
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        window.location.href = convite ? "/bem-vindo" : "/";
      } else {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) window.location.href = "/bem-vindo";
        else setConfirmar(true);
      }
    } catch (err) {
      setErro(traduzir(err instanceof Error ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  }

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!temSupabase) return;
    setEnviando(true);
    try {
      const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-senha` });
      if (error) throw error;
      setLinkEnviado(true);
    } catch (err) {
      setErro(traduzir(err instanceof Error ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  }

  function demonstracao() {
    localStorage.setItem(CHAVE_DEMO, "1");
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-white sm:border-x sm:border-line lg:grid lg:max-w-none lg:grid-cols-[1.15fr_1fr] lg:border-0">
      <CapaEntrada />
      <div className="relative z-10 -mt-8 flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pb-10 pt-8 lg:mt-0 lg:justify-center lg:rounded-none lg:px-16">
        <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[400px] lg:flex-none">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">{convite ? "Entre para a equipe" : modo === "entrar" ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
            <p className="mt-1 text-[14.5px] text-muted">Agenda, clientes, planos e caixa do seu banho e tosa.</p>
          </div>

          {esqueci ? (
            <div className="mt-8">
              {linkEnviado ? (
                <Aviso
                  tom="info"
                  icone={<MailCheck className="h-6 w-6" />}
                  titulo="Confira seu e-mail"
                  texto={`Se houver uma conta com ${email}, enviamos um link para criar uma senha nova. Abra o link neste mesmo aparelho.`}
                />
              ) : (
                <form onSubmit={pedirLink} className="space-y-4">
                  <p className="text-[14.5px] text-muted">Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova.</p>
                  <Campo rotulo="E-mail">
                    <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Campo>
                  {erro && <p className="rounded-2xl bg-bad-50 px-4 py-3 text-[14px] text-bad-700">{erro}</p>}
                  <Botao type="submit" disabled={enviando || !temSupabase}>
                    {enviando ? "Enviando…" : "Enviar link"}
                  </Botao>
                </form>
              )}
              <Botao
                variante="contorno"
                className="mt-4"
                onClick={() => {
                  setEsqueci(false);
                  setLinkEnviado(false);
                  setErro(null);
                }}
              >
                Voltar para entrar
              </Botao>
            </div>
          ) : confirmar ? (
            <div className="mt-8">
              <Aviso
                tom="info"
                icone={<MailCheck className="h-6 w-6" />}
                titulo="Confirme seu e-mail"
                texto={`Enviamos um link para ${email}. Abra o link e depois entre com seu e-mail e senha.`}
              />
              <Botao
                variante="contorno"
                className="mt-5"
                onClick={() => {
                  setConfirmar(false);
                  setModo("entrar");
                }}
              >
                Já confirmei, quero entrar
              </Botao>
            </div>
          ) : (
            <>
              <Segmentado
                className="mt-7"
                opcoes={[
                  { valor: "entrar", rotulo: "Entrar" },
                  { valor: "criar", rotulo: "Criar conta" },
                ]}
                valor={modo}
                onChange={(v) => {
                  setModo(v);
                  setErro(null);
                }}
              />
              {convite && (
                <Aviso
                  className="mt-5"
                  tom="info"
                  icone={<KeyRound className="h-5 w-5" />}
                  titulo="Você foi convidado para uma equipe"
                  texto={`Crie sua conta (ou entre, se já tiver) e o código ${convite} será usado em seguida.`}
                />
              )}
              {!temSupabase && (
                <Aviso className="mt-5" tom="warn" icone={<Sparkles className="h-5 w-5" />} titulo="Login ainda não configurado" texto="Use a demonstração enquanto o banco não está ligado." />
              )}
              <form onSubmit={enviar} className="mt-6 space-y-4">
                <Campo rotulo="E-mail">
                  <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </Campo>
                <Campo rotulo="Senha" dica={modo === "criar" ? "Mínimo de 6 caracteres." : undefined}>
                  <input
                    className="input"
                    type="password"
                    autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </Campo>
                {erro && <p className="rounded-2xl bg-bad-50 px-4 py-3 text-[14px] text-bad-700">{erro}</p>}
                <Botao type="submit" disabled={enviando || !temSupabase}>
                  {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
                </Botao>
                {modo === "entrar" && temSupabase && (
                  <button
                    type="button"
                    onClick={() => {
                      setEsqueci(true);
                      setErro(null);
                    }}
                    className="w-full py-1 text-center text-[14px] font-medium text-brand-600"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </form>
            </>
          )}

          <div className="mt-auto pt-10 text-center lg:mt-10 lg:pt-0">
            <button onClick={demonstracao} className="text-[14.5px] font-medium text-brand-600">
              Ver demonstração com dados de exemplo
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Foto de capa: no celular fica no topo; no computador ocupa a metade esquerda. */
function CapaEntrada() {
  return (
    <div className="relative h-[44dvh] min-h-[300px] overflow-hidden lg:sticky lg:top-0 lg:h-dvh">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/fotos/capa-banho.webp" alt="Cachorro enrolado na toalha depois do banho" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 62%" }} />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(29_18_74/0.10)_0%,rgb(40_26_99/0.25)_45%,rgb(29_18_74/0.85)_100%)]" />
      <div className="vidro absolute left-5 top-[max(20px,env(safe-area-inset-top))] flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-white lg:left-10 lg:top-10">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand-600">
          <PawPrint className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="text-[14px] font-bold tracking-tight">APP PET</span>
      </div>
      <div className="absolute inset-x-6 bottom-14 text-white lg:inset-x-12 lg:bottom-16">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/75">Banho e tosa</p>
        <h2 className="mt-2 text-[30px] font-bold leading-[1.08] tracking-tight lg:text-[44px]">
          Cada pet no horário,
          <br />
          cada tutor avisado.
        </h2>
      </div>
    </div>
  );
}
