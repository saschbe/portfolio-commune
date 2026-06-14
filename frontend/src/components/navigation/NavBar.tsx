"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function NavBar() {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchRole(userId: string) {
    const { data } = await supabase.from("profiles")
      .select("role, display_name").eq("id", userId).single();
    setIsPrivileged(["admin", "moderator"].includes(data?.role ?? ""));
    setProfileDisplayName(data?.display_name ?? "");
  }

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const setHeaderHeight = (height: number) => {
      document.documentElement.style.setProperty(
        "--site-header-height",
        `${height}px`,
      );
    };

    setHeaderHeight(header.getBoundingClientRect().height);

    const ro = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height);
    });
    ro.observe(header);

    return () => ro.disconnect();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    router.refresh();
  }

  const displayName =
    profileDisplayName ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] || "";
  const spaceHref  = isPrivileged ? "/admin" : "/dashboard";
  const spaceLabel = isPrivileged ? "Administration" : "Mon espace";

  return (
    <header ref={headerRef} className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/85 md:bg-black/50 border-b border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-10">
        <Link href="/" className="shrink-0">
          <Image
            src="/images/logo-white.png"
            alt="Plombières en Images"
            width={0}
            height={0}
            loading="eager"
            sizes="100vw"
            className="w-[130px] md:w-[190px] lg:w-[280px] xl:w-[320px] h-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10 ml-10 text-sm uppercase tracking-[0.2em] text-white">
          <Link href="/" className="hover:text-cyan-300 transition-all duration-300">Accueil</Link>
          <Link href="/galerie" className="hover:text-cyan-300 transition-all duration-300">Galerie</Link>
          <Link href="/carte" className="hover:text-cyan-300 transition-all duration-300">Carte</Link>
          <Link href="/mentions-legales" className="hover:text-cyan-300 transition-all duration-300">Infos</Link>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Mon compte"
                className={`text-white/70 hover:text-cyan-300 transition-all duration-300 ${dropdownOpen ? "text-cyan-300" : ""}`}
              >
                <UserIcon />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-3 w-48 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-xs text-white/60 truncate normal-case tracking-normal">{displayName}</p>
                    <p className="text-[10px] text-white/30 truncate normal-case tracking-normal mt-0.5">{user.email}</p>
                  </div>
                  <Link href={spaceHref} onClick={() => setDropdownOpen(false)}
                    className="flex items-center px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-cyan-300 hover:bg-white/5 transition-all">
                    {spaceLabel}
                  </Link>
                  <Link href="/compte" onClick={() => setDropdownOpen(false)}
                    className="flex items-center px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-cyan-300 hover:bg-white/5 transition-all">
                    Mon compte
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-red-400 hover:bg-white/5 transition-all border-t border-white/5">
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" aria-label="Se connecter" className="text-white/70 hover:text-cyan-300 transition-all duration-300">
              <UserIcon />
            </Link>
          )}
        </nav>

        {/* Mobile burger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white text-3xl z-50"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-zinc-950/98 backdrop-blur-2xl z-40">
          <div className="flex min-h-dvh flex-col items-center justify-center pt-32 gap-10 text-white text-2xl uppercase tracking-widest">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">Accueil</Link>
            <Link href="/galerie" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">Galerie</Link>
            <Link href="/carte" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">Carte</Link>
            <Link href="/mentions-legales" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">Infos</Link>
            <div className="border-t border-white/10 pt-8 flex flex-col items-center gap-6">
              {user ? (
                <>
                  <p className="text-sm text-white/35 tracking-normal normal-case">{displayName}</p>
                  <Link href={spaceHref} onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">{spaceLabel}</Link>
                  <Link href="/compte" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">Mon compte</Link>
                  <button onClick={handleLogout} className="hover:text-cyan-300 transition-all duration-300">Se déconnecter</button>
                </>
              ) : (
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">Se connecter</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
