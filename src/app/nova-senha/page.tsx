"use client";

// Volta do e-mail "esqueci minha senha": o link traz um código de uso único que vira uma sessão
// temporária; com ela a pessoa grava a senha nova e entra no app.

import { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, TriangleAlert } from "lucide-react";
import { supabase, temSupabase } from "@/lib/supabase/client";
import { Aviso, Botao, Campo } from "@/components/ui";

type Etapa = "verificando" | "pronta" | "invalida";

export default function NovaSenha() {
  const [etapa, setEtapa] = useState<Etapa>("verificando");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temSupabase) return setEtapa("invalida");
    (async () => {
      const sb = supabase();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        // O cliente pode já ter trocado o código sozinho; um segundo erro aqui não importa.
        await sb.auth.exchangeCodeForSession(code).catch(() => null);
        window.history.replaceState(null, "", "/nova-senha");
      }
      const { data } = await sb.auth.getSession();
      setEtapa(data.session ? "pronta" : "invalida");
    })();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== repetir) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    const { error } = await supabase().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      setErro(/should be different/i.test(error.message) ? "A senha nova precisa ser diferente da anterior." : error.message);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-white px-6 pb-10 pt-12 sm:border-x sm:border-line">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <KeyRound className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-[26px] font-bold tracking-tight">Criar senha nova</h1>

      {etapa === "verificando" && <p className="mt-2 text-[15px] text-muted">Conferindo o link…</p>}

      {etapa === "invalida" && (
        <div className="mt-6">
          <Aviso
            tom="warn"
            icone={<TriangleAlert className="h-5 w-5" />}
            titulo="Este link não vale mais"
            texto="Ele pode ter vencido, já ter sido usado ou ter sido aberto em outro aparelho. Peça um link novo na tela de entrar."
          />
          <Botao className="mt-5" onClick={() => (window.location.href = "/entrar")}>
            Voltar para entrar
          </Botao>
        </div>
      )}

      {etapa === "pronta" && (
        <form onSubmit={salvar} className="mt-6 space-y-4">
          <Campo rotulo="Senha nova" dica="Mínimo de 6 caracteres.">
            <input className="input" type="password" autoComplete="new-password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
          <Campo rotulo="Repita a senha">
            <input className="input" type="password" autoComplete="new-password" required minLength={6} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          </Campo>
          {erro && <p className="rounded-2xl bg-bad-50 px-4 py-3 text-[14px] text-bad-700">{erro}</p>}
          <Botao type="submit" disabled={enviando} icone={<LockKeyhole className="h-5 w-5" />}>
            {enviando ? "Salvando…" : "Salvar e entrar"}
          </Botao>
        </form>
      )}
    </main>
  );
}
