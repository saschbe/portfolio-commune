"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  year: string;
  type: string;
  restored: boolean;
  description: string;
  status?: string | null;
};

type Category = {
  id: string;
  nom: string;
  colonne: string;
};

type ActiveFilter = {
  colonne: string;
  nom: string;
  value: string;
};

const ASPECTS = [
  "aspect-[4/3]",
  "aspect-[3/4]",
  "aspect-[16/9]",
  "aspect-square",
  "aspect-[3/5]",
];

// ── Icônes ────────────────────────────────────────────────────────────────────

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

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

const RAISONS: { value: string; label: string }[] = [
  { value: "personne_non_consentante", label: "Personne non consentante" },
  { value: "informations_incorrectes", label: "Informations incorrectes" },
  { value: "photo_non_conforme",       label: "Photo non conforme" },
  { value: "violation_droits_auteur",  label: "Violation de droits d'auteur" },
  { value: "autre",                    label: "Autre" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GaleriePage() {
  const router = useRouter();

  // Auth
  const [user, setUser]               = useState<User | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  // Données
  const [photos, setPhotos]         = useState<Photo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);

  // Panneau filtres
  const [panelOpen, setPanelOpen]           = useState(false);
  const [activeFilters, setActiveFilters]   = useState<ActiveFilter[]>([]);
  const [searchValues, setSearchValues]     = useState<Record<string, string>>({});
  const [suggestions, setSuggestions]       = useState<Record<string, string[]>>({});
  const [focusedCat, setFocusedCat]         = useState<string | null>(null);
  const debounceRefs    = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const abortRefs       = useRef<Record<string, AbortController>>({});

  // Signalement
  const [reportingPhoto, setReportingPhoto] = useState<Photo | null>(null);
  const [reportRaison, setReportRaison]     = useState("");
  const [reportPrecision, setReportPrecision] = useState("");
  const [reportEmail, setReportEmail]       = useState("");
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportSuccess, setReportSuccess]   = useState(false);
  const [reportError, setReportError]       = useState("");
  const [reportTurnstileToken, setReportTurnstileToken] = useState<string | null>(null);
  const reportTurnstileRef = useRef<TurnstileInstance>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

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
    router.push("/");
  }

  // Fermer user dropdown si clic extérieur (fonctionne pour desktop ET mobile)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-user-dropdown]"))
        setUserDropdown(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Données ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      supabase
        .from("photos")
        .select("*")
        .or("status.eq.approved,status.is.null")
        .order("created_at", { ascending: false }),
      supabase.from("filtres_categories").select("*").order("nom"),
    ]).then(([{ data: photoData }, { data: catData }]) => {
      setPhotos(photoData ?? []);
      setCategories(catData ?? []);
      setLoading(false);
    });
  }, []);

  // Fermer visionneuse / modale avec Échap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (reportingPhoto) { closeReport(); return; }
        if (panelOpen) setPanelOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen, reportingPhoto]);

  function openReport(photo: Photo, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!user) {
      router.push("/login?next=/galerie");
      return;
    }
    setReportingPhoto(photo);
    setReportRaison("");
    setReportPrecision("");
    setReportEmail("");
    setReportSuccess(false);
  }

  function closeReport() {
    setReportingPhoto(null);
    setReportRaison("");
    setReportPrecision("");
    setReportEmail("");
    setReportSuccess(false);
    setReportError("");
    setReportTurnstileToken(null);
  }

  async function handleReport() {
    if (!reportingPhoto || !reportRaison || !reportTurnstileToken) return;
    setReportLoading(true);

    const verifyRes = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: reportTurnstileToken }),
    });
    if (!verifyRes.ok) {
      setReportLoading(false);
      reportTurnstileRef.current?.reset();
      setReportTurnstileToken(null);
      return;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentReports, error: countError } = await supabase
      .from("signalements")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("created_at", oneHourAgo);

    if (!countError && (recentReports ?? 0) >= 3) {
      setReportError("Limite atteinte : vous ne pouvez pas envoyer plus de 3 signalements par heure.");
      setReportLoading(false);
      return;
    }

    const { data: insertData, error } = await supabase.from("signalements").insert({
      photo_id: reportingPhoto.id,
      raison: reportRaison,
      details: reportPrecision.trim() || null,
      email: reportEmail.trim() || null,
      user_id: user!.id,
    }).select();
    console.log("[signalement] insert →", { data: insertData, error, errorJson: JSON.stringify(error) });
    if (!error) {
      supabase.from("photos").update({ status: "signaled" }).eq("id", reportingPhoto.id)
        .then(({ error: e }) => console.log("[signalement] photo signaled →", e ?? "ok"));
      const FUNCTIONS_URL = "https://fjglbztexnntivdrjhbv.supabase.co/functions/v1";
      const ANON_KEY = "sb_publishable_xMlW5BYoriE-iDe8JsLq1Q_lU3Pcjwj";
      const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2xienRleG5udGl2ZHJqaGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzE1NzksImV4cCI6MjA2Mzg0NzU3OX0.vIyVPvgSEDRtDmOEsGKMELMxJ6F9_h5DGT9KFTnMGGU";

      const authHeaders = {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
      };
      const reporterHeaders = {
        "Content-Type": "application/json",
        "apikey": ANON_JWT,
        "Authorization": `Bearer ${ANON_JWT}`,
      };

      fetch(`${FUNCTIONS_URL}/notify-new-photo`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ photo: { title: "Signalement reçu", village: reportRaison } }),
      })
        .then(async (res) => console.log("[signalement] notify-admin →", res.status, await res.text()))
        .catch((err) => console.error("[signalement] notify-admin error →", err));

      if (reportEmail.trim()) {
        fetch(`${FUNCTIONS_URL}/notify-reporter`, {
          method: "POST",
          headers: reporterHeaders,
          body: JSON.stringify({
            email: reportEmail.trim(),
            photoTitle: reportingPhoto.title,
            raison: reportRaison,
          }),
        })
          .then(async (res) => console.log("[signalement] notify-reporter →", res.status, await res.text()))
          .catch((err) => console.error("[signalement] notify-reporter error →", err));
      }
    }
    setReportLoading(false);
    setReportSuccess(true);
    setTimeout(() => closeReport(), 2500);
  }

  // ── Autocomplétion ───────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (catId: string, colonne: string, query: string) => {
    if (!query.trim()) { setSuggestions(prev => ({ ...prev, [catId]: [] })); return; }

    // Boolean column: suggestions statiques, pas de requête réseau
    if (colonne === "restored") {
      const opts = ["Oui", "Non"].filter(s => s.toLowerCase().includes(query.toLowerCase()));
      setSuggestions(prev => ({ ...prev, [catId]: opts }));
      return;
    }

    // Annuler la requête précédente pour ce champ si elle est encore en vol
    const controllers = abortRefs.current;
    controllers[catId]?.abort();
    const controller = new AbortController();
    controllers[catId] = controller;

    const { data, error } = await supabase
      .from("photos")
      .select(colonne)
      .or("status.eq.approved,status.is.null")
      .ilike(colonne, `%${query}%`)
      .limit(30)
      .abortSignal(controller.signal);

    // Ignorer silencieusement les requêtes annulées
    if (controller.signal.aborted) return;
    if (error) { setSuggestions(prev => ({ ...prev, [catId]: [] })); return; }

    const unique = [
      ...new Set(
        (data ?? [])
          .map((r) => String((r as unknown as Record<string, unknown>)[colonne] ?? ""))
          .filter(Boolean)
      ),
    ].slice(0, 7);
    setSuggestions(prev => ({ ...prev, [catId]: unique }));
  }, []);

  function handleSearchChange(catId: string, colonne: string, value: string) {
    setSearchValues(prev => ({ ...prev, [catId]: value }));
    if (debounceRefs.current[catId]) clearTimeout(debounceRefs.current[catId]);
    if (!value.trim()) {
      setSuggestions(prev => ({ ...prev, [catId]: [] }));
      return;
    }
    debounceRefs.current[catId] = setTimeout(() => fetchSuggestions(catId, colonne, value), 300);
  }

  function addFilter(cat: Category, value: string) {
    if (!value.trim()) return;
    if (activeFilters.some(f => f.colonne === cat.colonne && f.value.toLowerCase() === value.toLowerCase())) return;
    setActiveFilters(prev => [...prev, { colonne: cat.colonne, nom: cat.nom, value }]);
    setSearchValues(prev => ({ ...prev, [cat.id]: "" }));
    setSuggestions(prev => ({ ...prev, [cat.id]: [] }));
    setFocusedCat(null);
  }

  function removeFilter(i: number) {
    setActiveFilters(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Filtrage côté client ─────────────────────────────────────────────────────

  const filteredPhotos = activeFilters.length === 0
    ? photos
    : photos.filter(photo =>
        activeFilters.every(f => {
          const val = (photo as unknown as Record<string, unknown>)[f.colonne];
          if (val === null || val === undefined) return false;
          if (typeof val === "boolean") {
            const v = f.value.toLowerCase();
            return val ? (v === "oui" || v === "true") : (v === "non" || v === "false");
          }
          return String(val).toLowerCase() === f.value.toLowerCase();
        })
      );

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ?? "";

  const spaceHref  = isPrivileged ? "/admin" : "/dashboard";
  const spaceLabel = isPrivileged ? "Administration" : "Mon espace";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-10">

          {/* Logo */}
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

            {/* Compteur de photos */}
            {!loading && (
              <span className="tabular-nums tracking-[0.2em] text-sm uppercase">
                {activeFilters.length > 0
                  ? <span><span className="text-cyan-300 font-medium">{filteredPhotos.length}</span><span className="text-white/30"> / {photos.length} photos</span></span>
                  : <span className="text-white/50">{photos.length} photos</span>
                }
              </span>
            )}

            {/* Bouton Filtres dans la nav */}
            <button
              onClick={() => setPanelOpen(true)}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-full border text-sm uppercase tracking-[0.25em] transition-all duration-300 ${
                activeFilters.length > 0
                  ? "bg-cyan-300/10 border-cyan-300/40 text-cyan-300 hover:bg-cyan-300/20 hover:border-cyan-300/70"
                  : "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40"
              }`}
            >
              <FilterIcon />
              Filtres
              {activeFilters.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-300 text-black text-[10px] font-bold">
                  {activeFilters.length}
                </span>
              )}
            </button>

            {/* Icône utilisateur */}
            {user ? (
              <div className="relative" data-user-dropdown="">
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

          {/* Mobile : filtres + user */}
          <div className="md:hidden flex items-center gap-4">
            <button onClick={() => setPanelOpen(true)}
              className={`transition-colors duration-300 ${activeFilters.length > 0 ? "text-cyan-300" : "text-white/60 hover:text-cyan-300"}`}>
              <FilterIcon />
            </button>
            {user ? (
              <div className="relative" data-user-dropdown="">
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
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Titre */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-5xl font-light uppercase tracking-[0.15em] leading-[1.2]">
            Galerie
          </h1>
        </div>

        {/* Barre filtres actifs */}
        {activeFilters.length > 0 && (
          <div className="flex flex-col gap-3 mb-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveFilters([])}
                className="text-[10px] uppercase tracking-[0.25em] text-white/30 hover:text-white/60 transition-colors"
              >
                Tout effacer
              </button>
            </div>

            {/* Badges filtres actifs */}
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((f, i) => (
                <span key={i}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-[10px] uppercase tracking-[0.15em]"
                >
                  <span className="text-cyan-300/50">{f.nom} :</span>
                  {f.value}
                  <button onClick={() => removeFilter(i)}
                    aria-label={`Supprimer ${f.nom}`}
                    className="text-cyan-300/50 hover:text-cyan-300 leading-none transition-colors">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Galerie masonry */}
        {loading ? (
          <p className="text-center text-white/30 uppercase tracking-[0.35em] text-xs py-24">
            Chargement…
          </p>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-28 border border-white/5 rounded-3xl">
            <p className="text-white/20 uppercase tracking-[0.35em] text-xs mb-4">Aucune photo</p>
            {activeFilters.length > 0 && (
              <button onClick={() => setActiveFilters([])}
                className="text-cyan-300/50 hover:text-cyan-300 text-[10px] uppercase tracking-[0.25em] transition-colors">
                Effacer les filtres →
              </button>
            )}
          </div>
        ) : (
          <div className="columns-2 md:columns-3 xl:columns-4 gap-x-3">
            {filteredPhotos.map((photo, index) => (
              <Link key={photo.id}
                href={`/photo/${photo.id}`}
                className="block break-inside-avoid mb-3 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/3 backdrop-blur-md transition-all duration-700 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/5 hover:shadow-[0_20px_80px_rgba(34,211,238,0.10)]"
              >
                <div className={`relative ${ASPECTS[index % ASPECTS.length]}`}>
                  <Image
                    src={photo.src} alt={photo.title} fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    loading={index === 0 ? "eager" : "lazy"}
                    className="object-cover transition-all duration-2000 ease-out group-hover:scale-105 group-hover:brightness-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-70 group-hover:opacity-100 transition-all duration-700" />
                </div>
                <div className="absolute bottom-0 left-0 w-full p-5">
                  <h3 className="text-base font-light uppercase tracking-[0.08em] leading-tight">
                    {photo.title}
                  </h3>
                  <p className="text-cyan-300 text-[10px] uppercase tracking-[0.2em] mt-1.5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    {photo.village} · {photo.year}
                  </p>
                </div>
                {photo.restored && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-cyan-300/20 border border-cyan-300/30 text-cyan-300 text-[9px] uppercase tracking-[0.2em] rounded-full backdrop-blur-sm">
                    Restaurée
                  </div>
                )}
                <button
                  onClick={(e) => { e.preventDefault(); openReport(photo, e); }}
                  aria-label="Signaler cette photo"
                  className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white/40 hover:text-red-400 hover:bg-black/70"
                >
                  <FlagIcon />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Panneau filtres ───────────────────────────────────────────────── */}

      {/* Backdrop */}
      {panelOpen && (
        <div
          className="fixed top-16 inset-x-0 bottom-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Panneau latéral */}
      <div className={`fixed top-16 left-0 h-[calc(100vh-4rem)] overflow-hidden z-40 w-80 bg-zinc-950 border-r border-white/10 flex flex-col shadow-[4px_0_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${panelOpen ? "translate-x-0" : "-translate-x-full"}`}>

        {/* En-tête panneau */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div>
            <p className="text-cyan-300 uppercase tracking-[0.35em] text-xs mb-0.5">Filtres</p>
            {activeFilters.length > 0 && (
              <p className="text-white/30 text-[10px] uppercase tracking-[0.2em]">
                {activeFilters.length} actif{activeFilters.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            className="text-white/30 hover:text-white text-2xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Catégories */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {categories.length === 0 ? (
            <p className="text-white/25 text-[10px] uppercase tracking-[0.25em]">
              Aucune catégorie disponible
            </p>
          ) : (
            categories.map((cat) => {
              const currentSuggestions = suggestions[cat.id] ?? [];
              const currentValue       = searchValues[cat.id] ?? "";
              const isFocused          = focusedCat === cat.id;
              const showSuggestions    = currentValue.trim().length > 0 && currentSuggestions.length > 0;
              const showFreeText       = isFocused && currentValue.trim().length > 0 && currentSuggestions.length === 0;

              return (
                <div key={cat.id}>
                  <label className="block text-[10px] uppercase tracking-[0.3em] text-white mb-2">
                    {cat.nom}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={currentValue}
                      onChange={(e) => handleSearchChange(cat.id, cat.colonne, e.target.value)}
                      onFocus={() => setFocusedCat(cat.id)}
                      onBlur={() => setTimeout(() => {
                        setFocusedCat(null);
                        setSuggestions(prev => ({ ...prev, [cat.id]: [] }));
                      }, 150)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && currentValue.trim())
                          addFilter(cat, currentValue.trim());
                        if (e.key === "Escape") {
                          setSearchValues(prev => ({ ...prev, [cat.id]: "" }));
                          setSuggestions(prev => ({ ...prev, [cat.id]: [] }));
                        }
                      }}
                      placeholder={`Rechercher…`}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-300/50 transition-all"
                    />

                    {/* Suggestions */}
                    {(showSuggestions || showFreeText) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-10 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                        {currentSuggestions.map((s) => (
                          <button
                            key={s}
                            onMouseDown={() => addFilter(cat, s)}
                            className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-cyan-300 hover:bg-white/5 transition-all"
                          >
                            {s}
                          </button>
                        ))}
                        {showFreeText && (
                          <button
                            onMouseDown={() => addFilter(cat, currentValue.trim())}
                            className="w-full text-left px-4 py-2.5 text-sm text-white/50 hover:text-cyan-300 hover:bg-white/5 transition-all border-t border-white/5"
                          >
                            Filtrer par « {currentValue.trim()} »
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Filtres actifs pour cette catégorie */}
                  {activeFilters.filter(f => f.colonne === cat.colonne).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {activeFilters
                        .map((f, i) => f.colonne === cat.colonne ? { f, i } : null)
                        .filter(Boolean)
                        .map((item) => (
                          <span key={item!.i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-[9px] uppercase tracking-[0.15em]"
                          >
                            {item!.f.value}
                            <button
                              onClick={() => removeFilter(item!.i)}
                              className="text-cyan-300/50 hover:text-cyan-300 leading-none"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pied du panneau */}
        {activeFilters.length > 0 && (
          <div className="shrink-0 px-6 py-4 border-t border-white/10">
            <button
              onClick={() => setActiveFilters([])}
              className="w-full py-2.5 rounded-full border border-white/10 text-white/40 text-xs uppercase tracking-[0.25em] hover:border-white/20 hover:text-white/60 transition-all"
            >
              Effacer tous les filtres
            </button>
          </div>
        )}
      </div>

      {/* ── Modale signalement ──────────────────────────────────────────── */}
      {reportingPhoto && (
        <div className="fixed inset-0 z-200 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-zinc-950 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-[0_0_60px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            {reportSuccess ? (
              <div className="text-center py-4">
                <p className="text-emerald-400 uppercase tracking-[0.3em] text-xs mb-2">Signalement envoyé</p>
                <p className="text-white/40 text-sm">Merci, nous examinerons votre signalement.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 mb-1">Signaler une photo</p>
                    <p className="text-white text-sm font-light truncate max-w-65">{reportingPhoto.title}</p>
                  </div>
                  <button onClick={closeReport} className="text-white/30 hover:text-white text-2xl leading-none transition-colors">✕</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">Raison *</label>
                    <select
                      value={reportRaison}
                      onChange={(e) => setReportRaison(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200 [&>option]:bg-zinc-900"
                    >
                      <option value="" disabled>Sélectionner une raison…</option>
                      {RAISONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">Précision <span className="text-white/25 normal-case tracking-normal">optionnel</span></label>
                    <textarea
                      value={reportPrecision}
                      onChange={(e) => setReportPrecision(e.target.value)}
                      rows={3}
                      placeholder="Décrivez le problème…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">Email <span className="text-white/25 normal-case tracking-normal">optionnel — pour être recontacté</span></label>
                    <input
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200"
                    />
                  </div>
                </div>

                {reportError && (
                  <p className="mt-4 text-red-400 text-xs uppercase tracking-[0.2em] text-center">
                    {reportError}
                  </p>
                )}

                <div className="flex justify-center mt-4">
                  <Turnstile
                    ref={reportTurnstileRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={(token) => { setReportTurnstileToken(token); setReportError(""); }}
                    onExpire={() => setReportTurnstileToken(null)}
                    options={{ theme: "dark", size: "normal" }}
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={closeReport}
                    className="flex-1 py-3 rounded-full border border-white/10 text-white/40 text-xs uppercase tracking-[0.25em] hover:border-white/20 hover:text-white/60 transition-all duration-300"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportRaison || reportLoading || !reportTurnstileToken}
                    className="flex-1 py-3 rounded-full border border-red-400/40 bg-red-400/10 text-red-400 text-xs uppercase tracking-[0.25em] hover:bg-red-400/20 hover:border-red-400/70 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {reportLoading ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
