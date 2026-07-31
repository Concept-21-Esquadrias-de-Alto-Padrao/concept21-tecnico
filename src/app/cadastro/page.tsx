"use client";

import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { inputClass } from "@/components/action-form";
import { signUpWithEmail } from "@/lib/auth-client";
import { toUserFriendlyErrorMessage } from "@/lib/errors";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    try {
      if (!hasSupabaseBrowserEnv()) {
        throw new Error("Configure o Supabase para criar cadastros.");
      }

      if (!fullName.trim() || !email.trim() || !password) {
        throw new Error("Nome completo, e-mail e senha são obrigatórios.");
      }

      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }

      if (password !== confirmPassword) {
        throw new Error("A confirmação de senha não confere.");
      }

      setLoading(true);
      await signUpWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });

      setSuccess(true);
      setMessage(
        "Cadastro criado. Verifique seu e-mail para confirmar o acesso. Depois, entre na plataforma e aguarde a liberação do Administrador.",
      );
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(toUserFriendlyErrorMessage(error, "Não foi possível criar o cadastro."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent"
          >
            <ArrowLeft className="size-4" />
            Voltar ao login
          </Link>

          <div className="mb-4 grid size-12 place-items-center rounded-md bg-charcoal text-sm font-black text-white">
            C21
          </div>
          <p className="text-xs font-semibold uppercase text-accent">Concept21 Aluminium</p>
          <h1 className="mt-1 text-xl font-bold text-charcoal">Criar cadastro</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            O cadastro cria seu login. O nível de acesso será liberado depois pelo Administrador em Configurações.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {message ? (
            <div
              className={
                success
                  ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                  : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              }
            >
              {message}
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">Nome completo</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClass}
              autoComplete="name"
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">Telefone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
              autoComplete="tel"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">Confirmar senha</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {loading ? "Criando cadastro..." : "Criar cadastro"}
          </button>
        </form>
      </section>
    </main>
  );
}
