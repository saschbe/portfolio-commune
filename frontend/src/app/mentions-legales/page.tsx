"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const SECTIONS = [
  {
    num: "01",
    title: "Conditions d'utilisation",
    items: [
      "Le site est destiné à la préservation du patrimoine photographique des villages de la commune de Plombières.",
      "Les photos soumises doivent concerner la commune de Plombières et ses villages.",
      "En soumettant une photo, l'utilisateur confirme en être l'auteur ou avoir les droits de diffusion.",
      "Les photos sont soumises à validation avant publication.",
      "L'administration se réserve le droit de refuser toute photo non conforme.",
    ],
  },
  {
    num: "02",
    title: "Protection des personnes",
    items: [
      "Toute photo représentant des personnes identifiables doit avoir été prise avec leur consentement ou celui de leurs ayants droit.",
      "Les personnes photographiées peuvent demander le retrait de leur image en contactant l'administration.",
    ],
  },
  {
    num: "03",
    title: "Disclaimer",
    items: [
      "Les photos anciennes peuvent provenir de collections privées ou publiques.",
      "Malgré nos efforts, certaines informations historiques peuvent être incomplètes.",
      "Le site décline toute responsabilité quant à l'exactitude des données historiques fournies par les utilisateurs.",
      "Les droits d'auteur des photos restent la propriété de leurs auteurs respectifs.",
    ],
  },
];

export default function MentionsLegalesPage() {
  const router = useRouter();
  const [user, setUser]                 = useState<User | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) fetchRole(data.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else setIsPrivileged(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
    setIsPrivileged(["admin", "moderator"].includes(data?.role ?? ""));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserDropdown(false);
    router.refresh();
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node))
        setUserDropdown(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const displayName = (user?.user_metadata?.name as string | undefined) ?? user?.email?.split("@")[0] ?? "";
  const spaceHref   = isPrivileged ? "/admin" : "/dashboard";
  const spaceLabel  = isPrivileged ? "Administration" : "Mon espace";

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-10">

          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo-white.png"
              alt="Plombières en Images"
              width={0} height={0}
              loading="eager"
              sizes="100vw"
              className="w-[130px] md:w-[190px] lg:w-[280px] xl:w-[320px] h-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
            />
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-10 ml-10 text-sm uppercase tracking-[0.2em] text-white">
            <Link href="/" className="hover:text-cyan-300 transition-all duration-300">Accueil</Link>
            <Link href="/galerie" className="text-white/50 hover:text-cyan-300 transition-all duration-300">Galerie</Link>

            {user ? (
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setUserDropdown(!userDropdown)}
                  aria-label="Mon compte"
                  className={`transition-colors duration-300 ${userDropdown ? "text-cyan-300" : "text-white/70 hover:text-cyan-300"}`}
                >
                  <UserIcon />
                </button>
                {userDropdown && (
                  <div className="absolute right-0 top-full mt-3 w-48 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-xs text-white/60 truncate">{displayName}</p>
                      <p className="text-[10px] text-white/30 truncate mt-0.5">{user.email}</p>
                    </div>
                    <Link href={spaceHref} onClick={() => setUserDropdown(false)}
                      className="flex items-center px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-cyan-300 hover:bg-white/5 transition-all">
                      {spaceLabel}
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-red-400 hover:bg-white/5 transition-all border-t border-white/5">
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" aria-label="Se connecter"
                className="text-white/70 hover:text-cyan-300 transition-all duration-300">
                <UserIcon />
              </Link>
            )}
          </nav>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-4">
            {user ? (
              <div className="relative" ref={userDropdownRef}>
                <button onClick={() => setUserDropdown(!userDropdown)} aria-label="Mon compte"
                  className={`transition-colors duration-300 ${userDropdown ? "text-cyan-300" : "text-white/60 hover:text-cyan-300"}`}>
                  <UserIcon />
                </button>
                {userDropdown && (
                  <div className="absolute right-0 top-full mt-3 w-48 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                    <Link href={spaceHref} onClick={() => setUserDropdown(false)}
                      className="flex items-center px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-cyan-300 hover:bg-white/5 transition-all">
                      {spaceLabel}
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-red-400 hover:bg-white/5 transition-all border-t border-white/5">
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" aria-label="Se connecter"
                className="text-white/60 hover:text-cyan-300 transition-all duration-300">
                <UserIcon />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 pt-36 pb-24">

        {/* Titre */}
        <div className="mb-16">
          <p className="text-cyan-300 text-[10px] uppercase tracking-[0.45em] mb-4">
            Informations légales
          </p>
          <h1 className="text-3xl md:text-5xl font-light uppercase tracking-[0.15em] leading-[1.2]">
            Mentions<br className="md:hidden" /> légales
          </h1>
          <p className="mt-5 text-white/30 text-sm leading-relaxed max-w-md">
            Règles d'utilisation et informations légales relatives au site Plombières en Images.
          </p>
        </div>

        {/* Sections 01–03 */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.num}
              className="bg-white/[0.02] border border-white/10 backdrop-blur-md rounded-3xl p-8 md:p-10">
              <div className="flex items-start gap-6 mb-6">
                <span className="text-cyan-300 text-[11px] uppercase tracking-[0.35em] tabular-nums shrink-0 mt-1">
                  {section.num}
                </span>
                <h2 className="text-base md:text-lg font-light uppercase tracking-[0.2em] text-white">
                  {section.title}
                </h2>
              </div>
              <ul className="space-y-4 pl-0">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-cyan-300/40" />
                    <p className="text-white/55 text-sm leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Section 04 — RGPD & contact */}
          <div className="bg-white/[0.02] border border-cyan-300/20 backdrop-blur-md rounded-3xl p-8 md:p-10">
            <div className="flex items-start gap-6 mb-6">
              <span className="text-cyan-300 text-[11px] uppercase tracking-[0.35em] tabular-nums shrink-0 mt-1">
                04
              </span>
              <h2 className="text-base md:text-lg font-light uppercase tracking-[0.2em] text-white">
                RGPD &amp; contact plaintes
              </h2>
            </div>
            <div className="flex items-start gap-4 mb-8">
              <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-cyan-300/40" />
              <p className="text-white/55 text-sm leading-relaxed">
                Pour toute demande de retrait d'image, exercice de vos droits (accès, rectification, suppression)
                ou signalement d'un contenu non conforme, contactez notre équipe à l'adresse suivante&nbsp;:
              </p>
            </div>
            <a
              href="mailto:plaintes@photoplombieres.eu"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 text-xs uppercase tracking-[0.3em] hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300"
            >
              plaintes@photoplombieres.eu
            </a>
          </div>
        </div>

        {/* Pied */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.25em]">
            © {new Date().getFullYear()} Plombières en Images
          </p>
          <Link href="/"
            className="text-white/30 hover:text-cyan-300 text-[10px] uppercase tracking-[0.25em] transition-colors duration-300">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
