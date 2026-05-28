"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }

    setStatus("success");
  }

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200";
  const labelClass =
    "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

  if (status === "success") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-4">
            Inscription réussie
          </p>
          <p className="text-white/60 mb-8 max-w-sm mx-auto">
            Vérifiez votre email pour confirmer votre compte. Un administrateur
            devra ensuite vous attribuer un rôle.
          </p>
          <Link
            href="/login"
            className="px-8 py-3 rounded-full border border-cyan-300/40 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/10 transition-all duration-300"
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-4 text-center">
          Plombières en Images
        </p>
        <h1 className="text-3xl font-light uppercase tracking-[0.15em] mb-12 text-center">
          Créer un compte
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {status === "error" && (
            <p className="text-red-400 text-sm uppercase tracking-[0.2em]">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-4 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "Inscription…" : "Créer un compte"}
          </button>
        </form>

        <p className="mt-8 text-center text-white/30 text-sm">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="text-cyan-300/70 hover:text-cyan-300 transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
