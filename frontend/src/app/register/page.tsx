"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200";
const labelClass =
  "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    if (password !== confirm) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      setStatus("error");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }

    // Upsert the profile with role 'user' — safe to call even if the trigger already created it
    if (data.user) {
      await supabase
        .from("profiles")
        .upsert({ id: data.user.id, role: "user" }, { onConflict: "id" });
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 mx-auto mb-6 rounded-full border border-cyan-300/30 bg-cyan-300/10 flex items-center justify-center">
            <span className="text-cyan-300 text-2xl">✓</span>
          </div>
          <p className="text-cyan-300 uppercase tracking-[0.4em] text-xs mb-4">
            Compte créé
          </p>
          <h2 className="text-2xl font-light uppercase tracking-[0.15em] mb-6">
            Inscription réussie
          </h2>
          <p className="text-white/50 leading-relaxed mb-3">
            Votre compte a bien été créé avec le rôle <span className="text-white/70">utilisateur</span>.
          </p>
          <p className="text-white/35 text-sm leading-relaxed mb-10">
            Un administrateur doit valider votre accès avant que vous puissiez
            vous connecter à l&apos;espace d&apos;administration. Vous serez
            notifié par email.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 rounded-full border border-cyan-300/40 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/10 transition-all duration-300"
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
        <h1 className="text-3xl font-light uppercase tracking-[0.15em] mb-3 text-center">
          Créer un compte
        </h1>
        <p className="text-white/30 text-sm text-center mb-10">
          Votre accès sera activé après validation par un administrateur.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Nom</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom complet"
              autoComplete="name"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              autoComplete="email"
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="••••••••"
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Confirmer le mot de passe</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`${inputClass} ${
                confirm && confirm !== password
                  ? "border-red-400/40 focus:border-red-400/60"
                  : confirm && confirm === password
                    ? "border-emerald-400/40 focus:border-emerald-400/60"
                    : ""
              }`}
            />
            {confirm && confirm !== password && (
              <p className="mt-1.5 text-xs text-red-400/80">
                Les mots de passe ne correspondent pas.
              </p>
            )}
          </div>

          {status === "error" && (
            <p className="text-red-400 text-sm uppercase tracking-[0.2em]">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-4 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
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
