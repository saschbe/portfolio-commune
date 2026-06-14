"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/imageUrl";
import type { User } from "@supabase/supabase-js";
import NavBar from "@/components/navigation/NavBar";

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
  hameau?: string | null;
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

const VILLAGES_HAMEAUX: Record<string, string[]> = {
  Gemmenich: ["Völkerich"],
  Hombourg: ["Gulpen"],
  Montzen: ["Montzen-Gare"],
  Moresnet: ["Moresnet-Chapelle"],
  Sippenaeken: ["Terbruggen", "Beusdael"],
  Plombières: [],
};
const VILLAGES = Object.keys(VILLAGES_HAMEAUX);

const GALLERY_ASPECT = "aspect-[4/5]";

type GalleryView = "current" | "small" | "tiny";

const GALLERY_VIEWS: {
  value: GalleryView;
  label: string;
  iconColumns: number;
  columns: string;
  skeletonColumns: string;
  gap: string;
  cardMargin: string;
  imageSizes: string;
  padding: string;
  metaClass: string;
  titleClass: string;
  typeClass: string;
  badgeClass: string;
  reportClass: string;
}[] = [
  {
    value: "current",
    label: "Actuel",
    iconColumns: 1,
    columns: "columns-1 sm:columns-2 lg:columns-3 2xl:columns-4",
    skeletonColumns: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    gap: "gap-x-4",
    cardMargin: "mb-4",
    imageSizes:
      "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw",
    padding: "p-4",
    metaClass:
      "mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.22em] text-cyan-300/80",
    titleClass:
      "text-sm font-light uppercase tracking-[0.12em] leading-snug line-clamp-2 text-white",
    typeClass: "mt-2 line-clamp-1 text-xs text-white/40",
    badgeClass:
      "right-3 top-3 px-2 py-1 text-[8px] tracking-[0.22em]",
    reportClass: "left-3 top-3 p-2",
  },
  {
    value: "small",
    label: "Petit",
    iconColumns: 2,
    columns: "columns-2 sm:columns-3 lg:columns-4 2xl:columns-6",
    skeletonColumns: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
    gap: "gap-x-3",
    cardMargin: "mb-3",
    imageSizes:
      "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 17vw",
    padding: "p-3",
    metaClass:
      "mb-1.5 flex items-center gap-1.5 text-[8px] uppercase tracking-[0.18em] text-cyan-300/80",
    titleClass:
      "text-[12px] font-light uppercase tracking-[0.1em] leading-snug line-clamp-2 text-white",
    typeClass: "mt-1.5 line-clamp-1 text-[10px] text-white/40",
    badgeClass:
      "right-2 top-2 px-1.5 py-0.5 text-[7px] tracking-[0.16em]",
    reportClass: "left-2 top-2 p-1.5",
  },
  {
    value: "tiny",
    label: "Très petit",
    iconColumns: 3,
    columns: "columns-3 sm:columns-4 lg:columns-6 2xl:columns-8",
    skeletonColumns: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-8",
    gap: "gap-x-1.5 sm:gap-x-2",
    cardMargin: "mb-1.5 sm:mb-2",
    imageSizes:
      "(max-width: 640px) 50vw, (max-width: 1024px) 25vw, (max-width: 1536px) 17vw, 13vw",
    padding: "p-1.5 sm:p-2",
    metaClass:
      "mb-1 flex items-center gap-1 text-[7px] uppercase tracking-[0.14em] text-cyan-300/80",
    titleClass:
      "text-[10px] font-light uppercase tracking-[0.08em] leading-tight line-clamp-2 text-white",
    typeClass: "hidden",
    badgeClass:
      "right-1.5 top-1.5 px-1.5 py-0.5 text-[6px] tracking-[0.12em]",
    reportClass: "left-1.5 top-1.5 p-1",
  },
];

// ── Icônes ────────────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function GalleryViewIcon({ columns }: { columns: number }) {
  return (
    <span
      className="grid h-4 w-4 gap-0.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: columns * 2 }).map((_, index) => (
        <span key={index} className="rounded-[1px] bg-current" />
      ))}
    </span>
  );
}

const RAISONS: { value: string; label: string }[] = [
  { value: "personne_non_consentante", label: "Personne non consentante" },
  { value: "informations_incorrectes", label: "Informations incorrectes" },
  { value: "photo_non_conforme", label: "Photo non conforme" },
  { value: "violation_droits_auteur", label: "Violation de droits d'auteur" },
  { value: "autre", label: "Autre" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

function GalerieContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth
  const [user, setUser] = useState<User | null>(null);

  // Données
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Panneau filtres
  // Ouvert par défaut sur desktop (lg+), fermé sur mobile/tablet
  const [panelOpen, setPanelOpen] = useState(false);

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [focusedCat, setFocusedCat] = useState<string | null>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const abortRefs = useRef<Record<string, AbortController>>({});
  const [filterRestaureeOui, setFilterRestaureeOui] = useState(false);
  const [filterRestaureeNon, setFilterRestaureeNon] = useState(false);
  const [selectedVillages, setSelectedVillages] = useState<string[]>(() => {
    const v = searchParams.get("village");
    return v ? v.split(",").filter(Boolean) : [];
  });
  const [selectedHameau, setSelectedHameau] = useState<string | null>(() =>
    searchParams.get("hameau"),
  );
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  // Signalement
  const [reportingPhoto, setReportingPhoto] = useState<Photo | null>(null);
  const [reportRaison, setReportRaison] = useState("");
  const [reportPrecision, setReportPrecision] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportTurnstileToken, setReportTurnstileToken] = useState<
    string | null
  >(null);
  const reportTurnstileRef = useRef<TurnstileInstance>(null);
  const decadeMenuRef = useRef<HTMLDivElement>(null);
  const [decadeMenuOpen, setDecadeMenuOpen] = useState(false);
  const [galleryView, setGalleryView] = useState<GalleryView>("current");

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
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
        if (reportingPhoto) {
          closeReport();
          return;
        }
        if (decadeMenuOpen) {
          setDecadeMenuOpen(false);
          return;
        }
        if (panelOpen) setPanelOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [decadeMenuOpen, panelOpen, reportingPhoto]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        decadeMenuRef.current &&
        !decadeMenuRef.current.contains(e.target as Node)
      ) {
        setDecadeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      setReportError(
        "Limite atteinte : vous ne pouvez pas envoyer plus de 3 signalements par heure.",
      );
      setReportLoading(false);
      return;
    }

    const { error } = await supabase
      .from("signalements")
      .insert({
        photo_id: reportingPhoto.id,
        raison: reportRaison,
        details: reportPrecision.trim() || null,
        email: reportEmail.trim() || null,
        user_id: user!.id,
      });
    if (!error) {
      supabase
        .from("photos")
        .update({ status: "signaled" })
        .eq("id", reportingPhoto.id);
      const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
      const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const authHeaders = {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      };
      const reporterHeaders = authHeaders;

      fetch(`${FUNCTIONS_URL}/notify-new-photo`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          photo: { title: "Signalement reçu", village: reportRaison },
        }),
      }).catch(() => {});

      if (reportEmail.trim()) {
        fetch(`${FUNCTIONS_URL}/notify-reporter`, {
          method: "POST",
          headers: reporterHeaders,
          body: JSON.stringify({
            email: reportEmail.trim(),
            photoTitle: reportingPhoto.title,
            raison: reportRaison,
          }),
        }).catch(() => {});
      }
    }
    setReportLoading(false);
    setReportSuccess(true);
    setTimeout(() => closeReport(), 2500);
  }

  // ── Autocomplétion ───────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(
    async (catId: string, colonne: string, query: string) => {
      if (!query.trim()) {
        setSuggestions((prev) => ({ ...prev, [catId]: [] }));
        return;
      }

      // Boolean column: suggestions statiques, pas de requête réseau
      if (colonne === "restored") {
        const opts = ["Oui", "Non"].filter((s) =>
          s.toLowerCase().includes(query.toLowerCase()),
        );
        setSuggestions((prev) => ({ ...prev, [catId]: opts }));
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
      if (error) {
        setSuggestions((prev) => ({ ...prev, [catId]: [] }));
        return;
      }

      const unique = [
        ...new Set(
          (data ?? [])
            .map((r) =>
              String((r as unknown as Record<string, unknown>)[colonne] ?? ""),
            )
            .filter(Boolean),
        ),
      ].slice(0, 7);
      setSuggestions((prev) => ({ ...prev, [catId]: unique }));
    },
    [],
  );

  function handleSearchChange(catId: string, colonne: string, value: string) {
    setSearchValues((prev) => ({ ...prev, [catId]: value }));
    if (debounceRefs.current[catId]) clearTimeout(debounceRefs.current[catId]);
    if (!value.trim()) {
      setSuggestions((prev) => ({ ...prev, [catId]: [] }));
      return;
    }
    debounceRefs.current[catId] = setTimeout(
      () => fetchSuggestions(catId, colonne, value),
      300,
    );
  }

  function addFilter(cat: Category, value: string) {
    if (!value.trim()) return;
    if (
      activeFilters.some(
        (f) =>
          f.colonne === cat.colonne &&
          f.value.toLowerCase() === value.toLowerCase(),
      )
    )
      return;
    setActiveFilters((prev) => [
      ...prev,
      { colonne: cat.colonne, nom: cat.nom, value },
    ]);
    setSearchValues((prev) => ({ ...prev, [cat.id]: "" }));
    setSuggestions((prev) => ({ ...prev, [cat.id]: [] }));
    setFocusedCat(null);
  }

  function removeFilter(i: number) {
    setActiveFilters((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Filtrage côté client ─────────────────────────────────────────────────────

  // Restaurée : filtre actif seulement si un seul des deux boutons est activé
  const restoreeFiltered = filterRestaureeOui !== filterRestaureeNon;

  const filteredPhotos =
    activeFilters.length === 0 &&
    !restoreeFiltered &&
    selectedVillages.length === 0 &&
    !selectedHameau &&
    !yearFrom &&
    !yearTo
      ? photos
      : photos.filter((photo) => {
          if (
            selectedVillages.length > 0 &&
            !selectedVillages.includes(photo.village)
          )
            return false;
          if (selectedHameau && photo.hameau !== selectedHameau) return false;
          const passesFilters = activeFilters.every((f) => {
            const val = (photo as unknown as Record<string, unknown>)[
              f.colonne
            ];
            if (val === null || val === undefined) return false;
            if (typeof val === "boolean") {
              const v = f.value.toLowerCase();
              return val
                ? v === "oui" || v === "true"
                : v === "non" || v === "false";
            }
            return String(val).toLowerCase() === f.value.toLowerCase();
          });
          if (!passesFilters) return false;
          if (yearFrom || yearTo) {
            const y = parseInt(photo.year, 10);
            if (isNaN(y)) return false;
            if (yearFrom && y < parseInt(yearFrom, 10)) return false;
            if (yearTo && y > parseInt(yearTo, 10)) return false;
          }
          if (restoreeFiltered)
            return filterRestaureeOui
              ? photo.restored === true
              : photo.restored === false;
          return true;
        });

  const totalActiveFilters =
    activeFilters.length +
    (restoreeFiltered ? 1 : 0) +
    selectedVillages.length +
    (selectedHameau ? 1 : 0) +
    (yearFrom || yearTo ? 1 : 0);

  const photosByDecade = useMemo(() => {
    const groups = new Map<number | null, typeof filteredPhotos>();
    for (const p of filteredPhotos) {
      const y = parseInt(p.year, 10);
      const decade = isNaN(y) ? null : Math.floor(y / 10) * 10;
      if (!groups.has(decade)) groups.set(decade, []);
      groups.get(decade)!.push(p);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === null) return 1;
      if (b[0] === null) return -1;
      return a[0]! - b[0]!;
    });
  }, [filteredPhotos]);

  const orderedIds = useMemo(
    () => photosByDecade.flatMap(([, photos]) => photos.map((p) => p.id)),
    [photosByDecade],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const restoredCount = useMemo(
    () => filteredPhotos.filter((photo) => photo.restored).length,
    [filteredPhotos],
  );

  const hasActiveFilters = totalActiveFilters > 0;
  const galleryViewConfig =
    GALLERY_VIEWS.find((view) => view.value === galleryView) ??
    GALLERY_VIEWS[0];

  function resetFilters() {
    setActiveFilters([]);
    setFilterRestaureeOui(false);
    setFilterRestaureeNon(false);
    setSelectedVillages([]);
    setSelectedHameau(null);
    setYearFrom("");
    setYearTo("");
  }

  function photoHref(photoId: string) {
    const p = new URLSearchParams({ from: "galerie" });
    p.set("ids", orderedIds.join(","));
    if (selectedVillages.length > 0) p.set("village", selectedVillages.join(","));
    if (selectedHameau) p.set("hameau", selectedHameau);
    return `/photo/${photoId}?${p.toString()}`;
  }

  function decadeSectionId(decade: number | null) {
    return decade === null ? "decade-sans-date" : `decade-${decade}`;
  }

  function scrollToDecade(decade: number | null) {
    const target = document.getElementById(decadeSectionId(decade));
    if (!target) return;

    const headerHeight = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--site-header-height",
      ),
    );
    const top =
      target.getBoundingClientRect().top +
      window.scrollY -
      (Number.isNaN(headerHeight) ? 80 : headerHeight) -
      24;

    window.scrollTo({ top, behavior: "smooth" });
    setDecadeMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />

      {/* Bouton Filtres flottant */}
      <button
        onClick={() => setPanelOpen(true)}
        style={{
          top: "calc(var(--site-header-height) + 0.5rem)",
          right: "max(1.5rem, calc((100vw - 80rem) / 2 + 1.5rem))",
        }}
        className={`fixed z-30 flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] uppercase tracking-[0.25em] backdrop-blur-md transition-all duration-300 ${
          totalActiveFilters > 0
            ? "bg-cyan-300/10 border-cyan-300/40 text-cyan-300 hover:bg-cyan-300/20 hover:border-cyan-300/70"
            : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/40"
        }`}
      >
        <FilterIcon />
        Filtres
        {totalActiveFilters > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-300 text-black text-[9px] font-bold">
            {totalActiveFilters}
          </span>
        )}
      </button>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-[calc(var(--site-header-height)_+_1.5rem)] pb-12">
        {/* Titre */}
        <div className="mb-6 border-b border-white/10 pb-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="max-w-xl">
              <p className="mb-2 text-[9px] uppercase tracking-[0.35em] text-cyan-300">
                Archives visuelles
              </p>
              <h1 className="text-3xl md:text-4xl font-light uppercase tracking-[0.1em] leading-none">
                Galerie
              </h1>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/45">
                Mémoire photographique de Plombières et de ses villages,
                rassemblée par décennies et enrichie au fil des contributions.
              </p>
            </div>

            {!loading && (
              <div className="grid grid-cols-3 gap-2.5 sm:min-w-[25rem] lg:self-center">
                <div className="border border-white/10 bg-white/4 px-3.5 py-2">
                  <p className="text-lg font-light tabular-nums text-white">
                    {hasActiveFilters ? filteredPhotos.length : photos.length}
                  </p>
                  <p className="mt-0.5 text-[7px] uppercase tracking-[0.22em] text-white/35">
                    visibles
                  </p>
                </div>
                <div ref={decadeMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDecadeMenuOpen((open) => !open)}
                    aria-expanded={decadeMenuOpen}
                    aria-label="Ouvrir la liste des décennies"
                    className={`w-full cursor-pointer border px-3.5 py-2 text-left transition-all duration-200 ${
                      decadeMenuOpen
                        ? "border-cyan-300/45 bg-cyan-300/8 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                        : "border-white/10 bg-white/4 hover:border-cyan-300/30 hover:bg-white/6"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-light tabular-nums text-cyan-300">
                          {photosByDecade.length}
                        </p>
                        <p className="mt-0.5 text-[7px] uppercase tracking-[0.22em] text-white/35">
                          décennies
                        </p>
                      </div>
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-all ${
                          decadeMenuOpen
                            ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-300"
                            : "border-white/10 bg-black/20 text-white/45"
                        }`}
                      >
                        {decadeMenuOpen ? "−" : "+"}
                      </span>
                    </div>
                  </button>

                  {decadeMenuOpen && (
                    <div className="scrollbar-subtle absolute top-full left-0 mt-2 z-40 max-h-72 w-full overflow-y-auto border border-white/10 bg-zinc-950 shadow-[0_16px_50px_rgba(0,0,0,0.65)]">
                      {photosByDecade.map(([decade, decadePhotos]) => (
                        <button
                          key={decade ?? "sans-date"}
                          type="button"
                          onClick={() => scrollToDecade(decade)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
                        >
                          <span className="text-[10px] uppercase tracking-[0.25em] text-white/70">
                            {decade === null ? "Sans date" : `Années ${decade}`}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
                            {decadePhotos.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border border-white/10 bg-white/4 px-3.5 py-2">
                  <p className="text-lg font-light tabular-nums text-amber-200">
                    {restoredCount}
                  </p>
                  <p className="mt-0.5 text-[7px] uppercase tracking-[0.22em] text-white/35">
                    restaurées
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Barre filtres actifs */}
        {hasActiveFilters && (
          <div className="mb-12 flex flex-col gap-4 border-l border-cyan-300/30 pl-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/35">
                Sélection active
              </p>
              <button
                onClick={resetFilters}
                className="text-[10px] uppercase tracking-[0.25em] text-white/30 hover:text-white/70 transition-colors"
              >
                Tout effacer
              </button>
            </div>

            {/* Badges filtres actifs */}
            <div className="flex flex-wrap gap-2">
              {selectedVillages.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-[10px] uppercase tracking-[0.15em]"
                >
                  <span className="text-cyan-300/50">Village :</span>
                  {v}
                  <button
                    onClick={() => {
                      const next = selectedVillages.filter((x) => x !== v);
                      setSelectedVillages(next);
                      if (next.length !== 1) setSelectedHameau(null);
                    }}
                    aria-label={`Supprimer le filtre village ${v}`}
                    className="text-cyan-300/50 hover:text-cyan-300 leading-none transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {(yearFrom || yearTo) && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-[10px] uppercase tracking-[0.15em]">
                  <span className="text-cyan-300/50">Année :</span>
                  {yearFrom && yearTo
                    ? `${yearFrom} – ${yearTo}`
                    : yearFrom
                      ? `≥ ${yearFrom}`
                      : `≤ ${yearTo}`}
                  <button
                    onClick={() => {
                      setYearFrom("");
                      setYearTo("");
                    }}
                    aria-label="Supprimer le filtre année"
                    className="text-cyan-300/50 hover:text-cyan-300 leading-none transition-colors"
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedHameau && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-[10px] uppercase tracking-[0.15em]">
                  <span className="text-cyan-300/50">Hameau :</span>
                  {selectedHameau}
                  <button
                    onClick={() => setSelectedHameau(null)}
                    aria-label="Supprimer le filtre hameau"
                    className="text-cyan-300/50 hover:text-cyan-300 leading-none transition-colors"
                  >
                    ✕
                  </button>
                </span>
              )}
              {activeFilters.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-[10px] uppercase tracking-[0.15em]"
                >
                  <span className="text-cyan-300/50">{f.nom} :</span>
                  {f.value}
                  <button
                    onClick={() => removeFilter(i)}
                    aria-label={`Supprimer ${f.nom}`}
                    className="text-cyan-300/50 hover:text-cyan-300 leading-none transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 flex justify-end">
          <div className="inline-flex rounded-full border border-white/10 bg-white/4 p-1">
            {GALLERY_VIEWS.map((view) => {
              const active = galleryView === view.value;
              return (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => setGalleryView(view.value)}
                  aria-pressed={active}
                  aria-label={`Vue ${view.label}`}
                  title={`Vue ${view.label}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                    active
                      ? "bg-cyan-300/15 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                      : "text-white/45 hover:bg-white/6 hover:text-white/75"
                  }`}
                >
                  <GalleryViewIcon columns={view.iconColumns} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Galerie masonry */}
        {loading ? (
          <div className={`grid ${galleryViewConfig.skeletonColumns} gap-4`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={`${GALLERY_ASPECT} animate-pulse bg-white/5 border border-white/8`}
              />
            ))}
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center border border-white/8 bg-white/3 px-6 text-center">
            <p className="text-white/25 uppercase tracking-[0.35em] text-xs mb-4">
              Aucune photo
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-cyan-300/50 hover:text-cyan-300 text-[10px] uppercase tracking-[0.25em] transition-colors"
              >
                Effacer les filtres →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-16">
            {photosByDecade.map(([decade, decadePhotos]) => (
              <section
                key={decade ?? "sans-date"}
                id={decadeSectionId(decade)}
              >
                <div className="flex items-baseline gap-4 mb-6 pb-3 border-b border-white/10">
                  <h3 className="text-cyan-300 text-xl md:text-2xl font-light uppercase tracking-[0.3em]">
                    {decade === null ? "Sans date" : `Années ${decade}`}
                  </h3>
                  <span className="text-white/30 text-[10px] uppercase tracking-[0.25em]">
                    {decadePhotos.length} photo
                    {decadePhotos.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div
                  className={`${galleryViewConfig.columns} ${galleryViewConfig.gap}`}
                >
                  {decadePhotos.map((photo) => (
                    <Link
                      key={photo.id}
                      href={photoHref(photo.id)}
                      className={`group relative ${galleryViewConfig.cardMargin} block break-inside-avoid overflow-hidden border border-white/10 bg-zinc-950 transition-all duration-500 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_18px_60px_rgba(34,211,238,0.12)]`}
                    >
                      <div className={`relative ${GALLERY_ASPECT}`}>
                        <Image
                          src={imageUrl(photo.src, "thumb")}
                          alt={photo.title}
                          fill
                          sizes={galleryViewConfig.imageSizes}
                          loading="lazy"
                          className="object-cover transition-all duration-1000 ease-out group-hover:scale-105 group-hover:brightness-110"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/10 to-transparent opacity-75 transition-opacity duration-500 group-hover:opacity-95" />
                      </div>
                      <div
                        className={`absolute bottom-0 left-0 w-full ${galleryViewConfig.padding}`}
                      >
                        <div className={galleryViewConfig.metaClass}>
                          <span>{photo.village}</span>
                          {photo.year && (
                            <>
                              <span className="text-white/25">/</span>
                              <span className="text-white/50">{photo.year}</span>
                            </>
                          )}
                        </div>
                        <h4 className={galleryViewConfig.titleClass}>
                          {photo.title}
                        </h4>
                        {photo.type && (
                          <p className={galleryViewConfig.typeClass}>
                            {photo.type}
                          </p>
                        )}
                      </div>
                      {photo.restored && (
                        <span
                          className={`absolute border border-amber-200/30 bg-black/55 uppercase text-amber-200 backdrop-blur-md ${galleryViewConfig.badgeClass}`}
                          title="Restaurée"
                        >
                          Restaurée
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          openReport(photo, e);
                        }}
                        aria-label="Signaler cette photo"
                        className={`absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 backdrop-blur-sm text-white/45 hover:text-red-400 ${galleryViewConfig.reportClass}`}
                      >
                        <FlagIcon />
                      </button>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ── Panneau filtres ───────────────────────────────────────────────── */}

      {/* Backdrop */}
      {panelOpen && (
        <div
          style={{ top: "var(--site-header-height)" }}
          className="fixed inset-x-0 bottom-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Panneau latéral */}
      <div
        style={{
          top: "var(--site-header-height)",
          height: "calc(100vh - var(--site-header-height))",
        }}
        className={`fixed left-0 overflow-hidden z-40 w-80 bg-zinc-950 border-r border-white/10 flex flex-col shadow-[4px_0_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${panelOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* En-tête panneau */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div>
            <p className="text-cyan-300 uppercase tracking-[0.35em] text-xs mb-0.5">
              Filtres
            </p>
            {totalActiveFilters > 0 && (
              <p className="text-white/30 text-[10px] uppercase tracking-[0.2em]">
                {totalActiveFilters} actif{totalActiveFilters > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Fermer les filtres"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 text-white/60 text-[10px] uppercase tracking-[0.2em] hover:border-cyan-300/40 hover:text-cyan-300 hover:bg-white/5 transition-all"
          >
            <span className="text-base leading-none">✕</span>
            Fermer
          </button>
        </div>

        {/* Catégories */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Village */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
              Village
            </label>
            <div className="flex flex-wrap gap-2">
              {VILLAGES.map((v) => {
                const active = selectedVillages.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => {
                      setSelectedVillages((prev) =>
                        prev.includes(v)
                          ? prev.filter((x) => x !== v)
                          : [...prev, v],
                      );
                      setSelectedHameau(null);
                    }}
                    className={`px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-[0.2em] transition-all duration-200 ${
                      active
                        ? "bg-cyan-300/15 border-cyan-300/50 text-cyan-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hameau · Lieu-dit */}
          {selectedVillages.length === 1 &&
            VILLAGES_HAMEAUX[selectedVillages[0]]?.length > 0 && (
              <div className="animate-fadeIn">
                <label className="block text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
                  Hameau · Lieu-dit
                </label>
                <div className="flex flex-wrap gap-2">
                  {VILLAGES_HAMEAUX[selectedVillages[0]].map((h) => (
                    <button
                      key={h}
                      onClick={() =>
                        setSelectedHameau(selectedHameau === h ? null : h)
                      }
                      className={`px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-[0.2em] transition-all duration-200 ${
                        selectedHameau === h
                          ? "bg-cyan-300/15 border-cyan-300/50 text-cyan-300"
                          : "bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {categories.length === 0 ? (
            <p className="text-white/25 text-[10px] uppercase tracking-[0.25em]">
              Aucune catégorie disponible
            </p>
          ) : (
            categories
              .filter(
                (c) => !["village", "year", "restored"].includes(c.colonne),
              )
              .map((cat) => {
                const currentSuggestions = suggestions[cat.id] ?? [];
                const currentValue = searchValues[cat.id] ?? "";
                const isFocused = focusedCat === cat.id;
                const showSuggestions =
                  currentValue.trim().length > 0 &&
                  currentSuggestions.length > 0;
                const showFreeText =
                  isFocused &&
                  currentValue.trim().length > 0 &&
                  currentSuggestions.length === 0;

                return (
                  <div key={cat.id}>
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-white mb-2">
                      {cat.nom}
                    </label>

                    {cat.colonne === "restored" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFilterRestaureeOui((v) => !v)}
                          className={`flex-1 py-2 rounded-xl border text-xs uppercase tracking-[0.25em] transition-all duration-200 ${
                            filterRestaureeOui
                              ? "bg-cyan-300/10 border-cyan-300/40 text-cyan-300"
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/7 hover:border-white/20 hover:text-white/70"
                          }`}
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => setFilterRestaureeNon((v) => !v)}
                          className={`flex-1 py-2 rounded-xl border text-xs uppercase tracking-[0.25em] transition-all duration-200 ${
                            filterRestaureeNon
                              ? "bg-cyan-300/10 border-cyan-300/40 text-cyan-300"
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/7 hover:border-white/20 hover:text-white/70"
                          }`}
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      /* Champ texte + suggestions + badges */
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            value={currentValue}
                            onChange={(e) =>
                              handleSearchChange(
                                cat.id,
                                cat.colonne,
                                e.target.value,
                              )
                            }
                            onFocus={() => setFocusedCat(cat.id)}
                            onBlur={() =>
                              setTimeout(() => {
                                setFocusedCat(null);
                                setSuggestions((prev) => ({
                                  ...prev,
                                  [cat.id]: [],
                                }));
                              }, 150)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && currentValue.trim())
                                addFilter(cat, currentValue.trim());
                              if (e.key === "Escape") {
                                setSearchValues((prev) => ({
                                  ...prev,
                                  [cat.id]: "",
                                }));
                                setSuggestions((prev) => ({
                                  ...prev,
                                  [cat.id]: [],
                                }));
                              }
                            }}
                            placeholder="Rechercher…"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-300/50 transition-all"
                          />

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
                                  onMouseDown={() =>
                                    addFilter(cat, currentValue.trim())
                                  }
                                  className="w-full text-left px-4 py-2.5 text-sm text-white/50 hover:text-cyan-300 hover:bg-white/5 transition-all border-t border-white/5"
                                >
                                  Filtrer par « {currentValue.trim()} »
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {activeFilters.filter((f) => f.colonne === cat.colonne)
                          .length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {activeFilters
                              .map((f, i) =>
                                f.colonne === cat.colonne ? { f, i } : null,
                              )
                              .filter(Boolean)
                              .map((item) => (
                                <span
                                  key={item!.i}
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
                      </>
                    )}
                  </div>
                );
              })
          )}

          {/* Année — range */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
              Année
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Du"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/40 transition-all"
              />
              <span className="text-white/30 text-[10px] uppercase tracking-[0.2em] shrink-0">
                à
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Jusqu'à"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/40 transition-all"
              />
            </div>
          </div>

          {/* Photo restaurée */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Photo restaurée
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterRestaureeOui((v) => !v)}
                className={`px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-all ${
                  filterRestaureeOui
                    ? "bg-cyan-300/15 border-cyan-300/50 text-cyan-300"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                Oui
              </button>
              <button
                onClick={() => setFilterRestaureeNon((v) => !v)}
                className={`px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-all ${
                  filterRestaureeNon
                    ? "bg-cyan-300/15 border-cyan-300/50 text-cyan-300"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                Non
              </button>
            </div>
          </div>
        </div>

        {/* Pied du panneau */}
        {totalActiveFilters > 0 && (
          <div className="shrink-0 px-6 py-4 border-t border-white/10">
            <button
              onClick={() => {
                setActiveFilters([]);
                setFilterRestaureeOui(false);
                setFilterRestaureeNon(false);
                setSelectedVillages([]);
                setSelectedHameau(null);
                setYearFrom("");
                setYearTo("");
              }}
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
                <p className="text-emerald-400 uppercase tracking-[0.3em] text-xs mb-2">
                  Signalement envoyé
                </p>
                <p className="text-white/40 text-sm">
                  Merci, nous examinerons votre signalement.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 mb-1">
                      Signaler une photo
                    </p>
                    <p className="text-white text-sm font-light truncate max-w-65">
                      {reportingPhoto.title}
                    </p>
                  </div>
                  <button
                    onClick={closeReport}
                    className="text-white/30 hover:text-white text-2xl leading-none transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
                      Raison *
                    </label>
                    <select
                      value={reportRaison}
                      onChange={(e) => setReportRaison(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-300/60 focus:bg-white/7 transition-all duration-200 [&>option]:bg-zinc-900"
                    >
                      <option value="" disabled>
                        Sélectionner une raison…
                      </option>
                      {RAISONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
                      Précision{" "}
                      <span className="text-white/25 normal-case tracking-normal">
                        optionnel
                      </span>
                    </label>
                    <textarea
                      value={reportPrecision}
                      onChange={(e) => setReportPrecision(e.target.value)}
                      rows={3}
                      placeholder="Décrivez le problème…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/7 transition-all duration-200 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
                      Email{" "}
                      <span className="text-white/25 normal-case tracking-normal">
                        optionnel — pour être recontacté
                      </span>
                    </label>
                    <input
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/7 transition-all duration-200"
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
                    onSuccess={(token) => {
                      setReportTurnstileToken(token);
                      setReportError("");
                    }}
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
                    disabled={
                      !reportRaison || reportLoading || !reportTurnstileToken
                    }
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

export default function GaleriePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <GalerieContent />
    </Suspense>
  );
}
