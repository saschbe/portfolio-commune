"use client";

import NavBar from "@/components/navigation/NavBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/50 transition-all";
const labelClass =
  "block text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2";
const sectionClass =
  "bg-white/3 border border-white/10 rounded-2xl p-6 backdrop-blur-md";
const btnPrimary =
  "px-5 py-2.5 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.25em] hover:bg-cyan-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all";

type Status = "idle" | "loading" | "success" | "error";

export default function ComptePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [identityStatus, setIdentityStatus] = useState<Status>("idle");
  const [identityMsg, setIdentityMsg] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<Status>("idle");
  const [emailMsg, setEmailMsg] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status>("idle");
  const [passwordMsg, setPasswordMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    console.log("🟢 ComptePage MOUNT");

    async function loadProfile(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, display_name")
        .eq("id", userId)
        .single();
      if (!mounted) return;
      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setDisplayName(profile.display_name ?? "");
      }
      setLoading(false);
    }

    // Check initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setUser(data.session.user);
        loadProfile(data.session.user.id);
      } else {
        // Pas de session → redirect après un court délai pour laisser Supabase hydrater
        setTimeout(() => {
          if (mounted && !user) router.push("/login");
        }, 500);
      }
    });

    // Écoute les changements (au cas où la session arrive après le 1er check)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          loadProfile(session.user.id);
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveIdentity() {
    if (!user) return;
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setIdentityMsg("Prénom et nom requis (2 caractères minimum).");
      setIdentityStatus("error");
      return;
    }
    setIdentityStatus("loading");
    setIdentityMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq("id", user.id);
    if (error) {
      setIdentityMsg(`Erreur : ${error.message}`);
      setIdentityStatus("error");
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    setDisplayName(data?.display_name ?? "");
    setIdentityMsg("Modifications enregistrées.");
    setIdentityStatus("success");
  }

  async function handleChangeEmail() {
    if (!user) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailMsg("Adresse email invalide.");
      setEmailStatus("error");
      return;
    }
    if (trimmed === user.email) {
      setEmailMsg("C'est déjà votre adresse actuelle.");
      setEmailStatus("error");
      return;
    }
    setEmailStatus("loading");
    setEmailMsg("");
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    if (error) {
      setEmailMsg(`Erreur : ${error.message}`);
      setEmailStatus("error");
      return;
    }
    setEmailMsg(
      `Un email de confirmation a été envoyé à ${trimmed}. Cliquez sur le lien pour valider.`,
    );
    setEmailStatus("success");
    setNewEmail("");
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setPasswordMsg("Le mot de passe doit faire au moins 8 caractères.");
      setPasswordStatus("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Les deux mots de passe ne correspondent pas.");
      setPasswordStatus("error");
      return;
    }
    setPasswordStatus("loading");
    setPasswordMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(`Erreur : ${error.message}`);
      setPasswordStatus("error");
      return;
    }
    setPasswordMsg("Mot de passe modifié avec succès.");
    setPasswordStatus("success");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="min-h-screen bg-black text-white pt-32 px-5">
          <p className="text-white/30 uppercase tracking-[0.3em] text-xs text-center">
            Chargement…
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-black text-white pt-28 px-5 pb-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-light uppercase tracking-[0.2em] mb-2">
            Mon compte
          </h1>
          <p className="text-white/40 text-[11px] uppercase tracking-[0.25em] mb-10">
            {user?.email} · affiché publiquement comme « {displayName || "—"} »
          </p>

          <div className="space-y-6">
            {/* Identité */}
            <section className={sectionClass}>
              <p className="text-cyan-300 text-[10px] uppercase tracking-[0.35em] mb-5">
                Identité
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className={labelClass}>Prénom</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Nom</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                {identityMsg && (
                  <p
                    className={`text-[11px] ${identityStatus === "error" ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {identityMsg}
                  </p>
                )}
                <button
                  onClick={handleSaveIdentity}
                  disabled={identityStatus === "loading"}
                  className={`${btnPrimary} ml-auto`}
                >
                  {identityStatus === "loading" ? "…" : "Enregistrer"}
                </button>
              </div>
            </section>

            {/* Email */}
            <section className={sectionClass}>
              <p className="text-cyan-300 text-[10px] uppercase tracking-[0.35em] mb-5">
                Adresse email
              </p>
              <p className="text-xs text-white/40 mb-4">
                Actuelle : <span className="text-white/70">{user?.email}</span>
              </p>
              <label className={labelClass}>Nouvelle adresse email</label>
              <input
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nouvelle@adresse.be"
                className={`${inputClass} mb-5`}
              />
              <div className="flex items-center justify-between gap-4">
                {emailMsg && (
                  <p
                    className={`text-[11px] ${emailStatus === "error" ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {emailMsg}
                  </p>
                )}
                <button
                  onClick={handleChangeEmail}
                  disabled={emailStatus === "loading" || !newEmail}
                  className={`${btnPrimary} ml-auto`}
                >
                  {emailStatus === "loading" ? "…" : "Changer"}
                </button>
              </div>
            </section>

            {/* Mot de passe */}
            <section className={sectionClass}>
              <p className="text-cyan-300 text-[10px] uppercase tracking-[0.35em] mb-5">
                Mot de passe
              </p>
              <div className="space-y-4 mb-5">
                <div>
                  <label className={labelClass}>Nouveau mot de passe</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                {passwordMsg && (
                  <p
                    className={`text-[11px] ${passwordStatus === "error" ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {passwordMsg}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={
                    passwordStatus === "loading" ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className={`${btnPrimary} ml-auto`}
                >
                  {passwordStatus === "loading" ? "…" : "Changer"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
