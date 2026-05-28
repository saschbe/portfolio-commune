"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("[login] signInWithPassword →", { data, error });

      if (error) {
        console.error("[login] Supabase error:", error.status, error.message, error);
        setErrorMsg(error.message);
        setStatus("error");
        return;
      }

      console.log("[login] session:", data.session);
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error("[login] exception inattendue:", err);
      setErrorMsg("Erreur inattendue, voir la console.");
      setStatus("error");
    }
  }

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200";
  const labelClass =
    "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

  return (
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
        {status === "loading" ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-4 text-center">
          Plombières en Images
        </p>
        <h1 className="text-3xl font-light uppercase tracking-[0.15em] mb-12 text-center">
          Connexion
        </h1>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-center text-white/30 text-sm">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="text-cyan-300/70 hover:text-cyan-300 transition-colors"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
