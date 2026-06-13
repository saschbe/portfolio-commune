"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/navigation/NavBar";

// ── Types ──────────────────────────────────────────────────────────────────────

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  year: string;
  type: string;
  restored: boolean;
  description: string;
  latitude: number;
  longitude: number;
};

type Lieu = {
  id: string;
  nom: string;
  village: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
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

// ── Constantes ─────────────────────────────────────────────────────────────────

const VILLAGES_HAMEAUX: Record<string, string[]> = {
  Gemmenich: ["Völkerich"],
  Hombourg: ["Gulpen"],
  Montzen: ["Montzen-Gare"],
  Moresnet: ["Moresnet-Chapelle"],
  Sippenaeken: ["Terbruggen", "Beusdael"],
  Plombières: [],
};
const VILLAGES = Object.keys(VILLAGES_HAMEAUX);

// ── MapClient chargé dynamiquement ─────────────────────────────────────────────

const MapClient = dynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <p className="text-white/30 uppercase tracking-[0.35em] text-xs">
        Chargement de la carte…
      </p>
    </div>
  ),
});

// ── Icône filtre ───────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CartePage() {
  const [headerH, setHeaderH] = useState(80);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeaderH(entry.contentRect.height);
    });
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Panneau filtres — ouvert par défaut sur desktop
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    if (window.innerWidth >= 1024) setPanelOpen(true);
  }, []);

  // Données
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from("photos")
        .select(
          "id, src, title, village, year, type, restored, description, latitude, longitude",
        )
        .eq("status", "approved")
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      supabase
        .from("lieux")
        .select("id, nom, village, type, description, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      supabase.from("filtres_categories").select("*").order("nom"),
    ]).then(([{ data: photoData }, { data: lieuxData }, { data: catData }]) => {
      setPhotos((photoData ?? []) as Photo[]);
      setLieux((lieuxData ?? []) as Lieu[]);
      setCategories(catData ?? []);
      setLoading(false);
    });
  }, []);

  // Fermer panneau avec Échap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && panelOpen) setPanelOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  // ── États filtres ──────────────────────────────────────────────────────────

  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [filterRestaureeOui, setFilterRestaureeOui] = useState(false);
  const [filterRestaureeNon, setFilterRestaureeNon] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [focusedCat, setFocusedCat] = useState<string | null>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const abortRefs = useRef<Record<string, AbortController>>({});

  function resetFilters() {
    setActiveFilters([]);
    setFilterRestaureeOui(false);
    setFilterRestaureeNon(false);
    setSelectedVillages([]);
    setYearFrom("");
    setYearTo("");
  }

  // ── Autocomplétion ─────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(
    async (catId: string, colonne: string, query: string) => {
      if (!query.trim()) {
        setSuggestions((prev) => ({ ...prev, [catId]: [] }));
        return;
      }
      if (colonne === "restored") {
        const opts = ["Oui", "Non"].filter((s) =>
          s.toLowerCase().includes(query.toLowerCase()),
        );
        setSuggestions((prev) => ({ ...prev, [catId]: opts }));
        return;
      }
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

  // ── Filtrage ───────────────────────────────────────────────────────────────

  const restoreeFiltered = filterRestaureeOui !== filterRestaureeNon;

  const filteredPhotos = useMemo(() => {
    if (
      activeFilters.length === 0 &&
      !restoreeFiltered &&
      selectedVillages.length === 0 &&
      !yearFrom &&
      !yearTo
    )
      return photos;

    return photos.filter((photo) => {
      if (
        selectedVillages.length > 0 &&
        !selectedVillages.includes(photo.village)
      )
        return false;
      const passesFilters = activeFilters.every((f) => {
        const val = (photo as unknown as Record<string, unknown>)[f.colonne];
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
  }, [
    photos,
    selectedVillages,
    activeFilters,
    yearFrom,
    yearTo,
    restoreeFiltered,
    filterRestaureeOui,
  ]);

  const filteredLieux = useMemo(() => {
    return lieux.filter((l) => {
      if (selectedVillages.length > 0 && !selectedVillages.includes(l.village))
        return false;
      const typeFilter = activeFilters.find((f) => f.colonne === "type");
      if (typeFilter && l.type !== typeFilter.value) return false;
      return true;
    });
  }, [lieux, selectedVillages, activeFilters]);

  const totalActiveFilters =
    activeFilters.length +
    (restoreeFiltered ? 1 : 0) +
    selectedVillages.length +
    (yearFrom || yearTo ? 1 : 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-full relative overflow-hidden bg-black">
      {/* Carte plein écran — isolée pour contenir les z-indexes Leaflet */}
      <div className="absolute inset-0 isolate">
        {!loading && <MapClient photos={filteredPhotos} lieux={filteredLieux} />}
        {loading && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <p className="text-white/30 uppercase tracking-[0.35em] text-xs">
              Chargement…
            </p>
          </div>
        )}
      </div>

      <NavBar />

      {/* Bouton Filtres flottant */}
      <button
        onClick={() => setPanelOpen(true)}
        className={`fixed top-24 left-6 z-9999 flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] uppercase tracking-[0.25em] backdrop-blur-md transition-all duration-300 ${
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

      {/* Légende */}
      <div className="fixed bottom-6 right-6 z-30 bg-zinc-950/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/70">
            Lieu historique
          </span>
        </div>
        <span className="text-white/10">|</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/70">
            Photo archivée
          </span>
        </div>
      </div>

      {/* Backdrop */}
      {panelOpen && (
        <div
          style={{ top: headerH }}
          className="fixed inset-x-0 bottom-0 z-600 bg-black/60 backdrop-blur-sm"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Panneau filtres */}
      <div
        style={{ top: headerH, height: `calc(100vh - ${headerH}px)` }}
        className={`fixed left-0 overflow-hidden z-700 w-80 bg-zinc-950 border-r border-white/10 flex flex-col shadow-[4px_0_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${panelOpen ? "translate-x-0" : "-translate-x-full"}`}
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

        {/* Corps du panneau */}
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
                    onClick={() =>
                      setSelectedVillages((prev) =>
                        prev.includes(v)
                          ? prev.filter((x) => x !== v)
                          : [...prev, v],
                      )
                    }
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

          {/* Catégories dynamiques */}
          {categories
            .filter((c) => !["village", "year", "restored"].includes(c.colonne))
            .map((cat) => {
              const currentSuggestions = suggestions[cat.id] ?? [];
              const currentValue = searchValues[cat.id] ?? "";
              const isFocused = focusedCat === cat.id;
              const showSuggestions =
                currentValue.trim().length > 0 && currentSuggestions.length > 0;
              const showFreeText =
                isFocused &&
                currentValue.trim().length > 0 &&
                currentSuggestions.length === 0;

              return (
                <div key={cat.id}>
                  <label className="block text-[10px] uppercase tracking-[0.3em] text-white mb-2">
                    {cat.nom}
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={currentValue}
                      onChange={(e) =>
                        handleSearchChange(cat.id, cat.colonne, e.target.value)
                      }
                      onFocus={() => setFocusedCat(cat.id)}
                      onBlur={() =>
                        setTimeout(() => {
                          setFocusedCat(null);
                          setSuggestions((prev) => ({ ...prev, [cat.id]: [] }));
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
                          setSuggestions((prev) => ({ ...prev, [cat.id]: [] }));
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
                </div>
              );
            })}

          {/* Année */}
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
              onClick={resetFilters}
              className="w-full py-2.5 rounded-full border border-white/10 text-white/40 text-xs uppercase tracking-[0.25em] hover:border-white/20 hover:text-white/60 transition-all"
            >
              Effacer tous les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
