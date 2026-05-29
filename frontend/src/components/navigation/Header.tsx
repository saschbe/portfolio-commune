"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) fetchRole(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRole(session.user.id);
        } else {
          setIsPrivileged(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    setIsPrivileged(["admin", "moderator"].includes(data?.role ?? ""));
  }

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    router.refresh();
  }

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  const spaceHref = isPrivileged ? "/admin" : "/dashboard";
  const spaceLabel = isPrivileged ? "Administration" : "Mon espace";

  return (
    <>
      <header id="accueil" className="relative h-screen w-full overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/header-bg.png"
            alt="Plombières"
            fill
            priority
            loading="eager"
            className="object-cover animate-slowZoom"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Top navigation */}
        <div className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-10">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Image
                src="/images/logo-white.png"
                alt="Plombières en Images"
                width={0}
                height={0}
                loading="eager"
                sizes="100vw"
                className="w-[130px] md:w-[190px] lg:w-[280px] xl:w-[320px] h-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
              />
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-10 ml-10 text-sm uppercase tracking-[0.2em] text-white">
              <a href="#accueil" className="hover:text-cyan-300 transition-all duration-300">
                Accueil
              </a>
              <a href="/galerie" className="hover:text-cyan-300 transition-all duration-300">
                Galerie
              </a>
              <a href="#histoire" className="hover:text-cyan-300 transition-all duration-300">
                Histoire
              </a>
              <a href="/carte" className="hover:text-cyan-300 transition-all duration-300">
                Carte
              </a>
              <a href="/mentions-legales" className="hover:text-cyan-300 transition-all duration-300">
                Infos
              </a>

              {/* Auth — desktop */}
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
                        <p className="text-xs text-white/60 truncate font-normal normal-case tracking-normal">{displayName}</p>
                        <p className="text-[10px] text-white/30 truncate font-normal normal-case tracking-normal mt-0.5">{user.email}</p>
                      </div>
                      <Link
                        href={spaceHref}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-cyan-300 hover:bg-white/5 transition-all"
                      >
                        {spaceLabel}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-red-400 hover:bg-white/5 transition-all border-t border-white/5"
                      >
                        Se déconnecter
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  aria-label="Se connecter"
                  className="text-white/70 hover:text-cyan-300 transition-all duration-300"
                >
                  <UserIcon />
                </Link>
              )}
            </nav>

            {/* Mobile button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white text-3xl z-50"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-20 flex items-center justify-center min-h-screen pt-32 text-center px-6">
          <div className="max-w-4xl animate-fadeInUp">
            <p className="text-cyan-300 uppercase tracking-[0.45em] text-sm md:text-base mb-6">
              Archives photographiques
            </p>

            <h1 className="text-white text-3xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2] drop-shadow-2xl">
              Les images d&apos;hier
              <br />
              et d&apos;aujourd&apos;hui
            </h1>

            <p className="mt-8 text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Un espace dédié aux photographies anciennes et actuelles de la
              commune de Plombières afin de préserver, partager et transmettre
              la mémoire visuelle de ses villages.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <a
                href="#histoire"
                className="px-8 py-4 bg-white/10 border border-white/20 backdrop-blur-md text-white uppercase tracking-[0.25em] text-sm hover:bg-white hover:text-black transition-all duration-500"
              >
                Découvrir
              </a>
              <a
                href="#"
                className="px-8 py-4 border border-cyan-300/40 text-cyan-200 uppercase tracking-[0.25em] text-sm hover:bg-cyan-300 hover:text-black transition-all duration-500"
              >
                Explorer les archives
              </a>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black/95 backdrop-blur-xl z-40">
            <div className="flex flex-col items-center justify-center min-h-screen pt-32 gap-10 text-white text-2xl uppercase tracking-widest">
              <a href="#accueil" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">
                Accueil
              </a>
              <a href="/galerie" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">
                Galerie
              </a>
              <a href="#histoire" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">
                Histoire
              </a>
              <a href="/carte" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">
                Carte
              </a>
              <a href="/mentions-legales" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-300 transition-all duration-300">
                Infos
              </a>

              {/* Auth — mobile */}
              <div className="border-t border-white/10 pt-8 flex flex-col items-center gap-6">
                {user ? (
                  <>
                    <p className="text-sm text-white/35 tracking-normal normal-case">
                      {displayName}
                    </p>
                    <Link
                      href={spaceHref}
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-cyan-300 transition-all duration-300"
                    >
                      {spaceLabel}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="hover:text-cyan-300 transition-all duration-300"
                    >
                      Se déconnecter
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="hover:text-cyan-300 transition-all duration-300"
                  >
                    Se connecter
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
