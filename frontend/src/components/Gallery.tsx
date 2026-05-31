"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { imageUrl, imageProps } from "@/lib/imageUrl";

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

// Aspect ratios alternés pour l'effet masonry
const ASPECTS = [
  "aspect-[4/3]",
  "aspect-[3/4]",
  "aspect-[16/9]",
  "aspect-square",
  "aspect-[3/5]",
];

// ── Icône filtre ──────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Gallery() {
  // Données
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Visionneuse plein écran
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showInfo, setShowInfo] = useState(true);

  const dropdownRef  = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement initial
  useEffect(() => {
    Promise.all([
      supabase.from("photos").select("*").order("created_at", { ascending: false }),
      supabase.from("filtres_categories").select("*").order("nom"),
    ]).then(([{ data: photoData }, { data: catData }]) => {
      setPhotos(photoData ?? []);
      setCategories(catData ?? []);
      setLoading(false);
    });
  }, []);

  // Fermer le menu si clic extérieur
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Fermer visionneuse avec Échap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedPhoto(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function closeMenu() {
    setFilterMenuOpen(false);
    setSelectedCategory(null);
    setSearchValue("");
    setSuggestions([]);
  }

  // Autocomplétion
  const fetchSuggestions = useCallback(async (colonne: string, query: string) => {
    if (!query.trim()) { setSuggestions([]); return; }
    setLoadingSuggestions(true);
    const { data } = await supabase
      .from("photos")
      .select(colonne)
      .ilike(colonne, `%${query}%`)
      .limit(30);
    const unique = [
      ...new Set(
        (data ?? [])
          .map((r) => String((r as unknown as Record<string, unknown>)[colonne] ?? ""))
          .filter(Boolean)
      ),
    ].slice(0, 8);
    setSuggestions(unique);
    setLoadingSuggestions(false);
  }, []);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!selectedCategory) return;
    debounceRef.current = setTimeout(
      () => fetchSuggestions(selectedCategory.colonne, value),
      250
    );
  }

  function addFilter(value: string) {
    if (!selectedCategory || !value.trim()) return;
    if (activeFilters.some(
      (f) => f.colonne === selectedCategory.colonne && f.value.toLowerCase() === value.toLowerCase()
    )) return;
    setActiveFilters((prev) => [
      ...prev,
      { colonne: selectedCategory.colonne, nom: selectedCategory.nom, value },
    ]);
    setSearchValue("");
    setSuggestions([]);
    setSelectedCategory(null);
  }

  function removeFilter(i: number) {
    setActiveFilters((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Filtrage côté client
  const filteredPhotos = activeFilters.length === 0
    ? photos
    : photos.filter((photo) =>
        activeFilters.every((f) => {
          const val = (photo as Record<string, unknown>)[f.colonne];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase() === f.value.toLowerCase();
        })
      );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section id="archives" className="relative bg-black text-white py-16 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">

        {/* Titre */}
        <div className="text-center mb-12">
          <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-6">
            Galerie
          </p>
          <h2 className="text-2xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2]">
            Les images d&apos;hier
            <br />
            et d&apos;aujourd&apos;hui
          </h2>
        </div>

        {/* Barre de filtres */}
        <div className="flex flex-col gap-4 mb-10">
          <div className="flex items-center gap-4 flex-wrap">

            {/* Bouton Filtres + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => filterMenuOpen ? closeMenu() : setFilterMenuOpen(true)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm uppercase tracking-[0.25em] transition-all duration-300 ${
                  filterMenuOpen || activeFilters.length > 0
                    ? "bg-cyan-300/10 border-cyan-300/40 text-cyan-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
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

              {/* Menu déroulant */}
              {filterMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] z-50 overflow-hidden">
                  {selectedCategory ? (
                    /* Autocomplétion */
                    <div className="p-4">
                      <button
                        onClick={() => { setSelectedCategory(null); setSearchValue(""); setSuggestions([]); }}
                        className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-[0.2em] hover:text-white/70 transition-colors mb-3"
                      >
                        ← {selectedCategory.nom}
                      </button>
                      <input
                        type="text"
                        autoFocus
                        value={searchValue}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && searchValue.trim()) addFilter(searchValue.trim());
                          if (e.key === "Escape") { setSelectedCategory(null); setSearchValue(""); setSuggestions([]); }
                        }}
                        placeholder={`Rechercher ${selectedCategory.nom.toLowerCase()}…`}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/50 transition-all"
                      />

                      {/* Suggestions */}
                      {suggestions.length > 0 && (
                        <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => addFilter(s)}
                              className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-cyan-300 hover:bg-white/5 rounded-xl transition-all"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}

                      {loadingSuggestions && (
                        <p className="mt-2 text-[10px] text-white/30 uppercase tracking-[0.2em] px-1">
                          Recherche…
                        </p>
                      )}

                      {!loadingSuggestions && searchValue.trim() && suggestions.length === 0 && (
                        <button
                          onClick={() => addFilter(searchValue.trim())}
                          className="w-full text-left mt-2 px-4 py-2 text-sm text-white/50 hover:text-cyan-300 hover:bg-white/5 rounded-xl transition-all"
                        >
                          Filtrer par « {searchValue.trim()} »
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Liste des catégories */
                    <div className="py-2">
                      {categories.length === 0 ? (
                        <p className="px-4 py-3 text-[10px] text-white/30 uppercase tracking-[0.25em]">
                          Aucune catégorie disponible
                        </p>
                      ) : (
                        categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat)}
                            className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/5 transition-all"
                          >
                            {cat.nom}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tout effacer */}
            {activeFilters.length > 0 && (
              <button
                onClick={() => setActiveFilters([])}
                className="text-[10px] uppercase tracking-[0.25em] text-white/30 hover:text-white/60 transition-colors"
              >
                Tout effacer
              </button>
            )}
          </div>

          {/* Badges de filtres actifs */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
          )}
        </div>

        {/* Galerie masonry */}
        {loading ? (
          <p className="text-center text-white/30 uppercase tracking-[0.35em] text-xs py-20">
            Chargement…
          </p>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-24 border border-white/5 rounded-3xl">
            <p className="text-white/20 uppercase tracking-[0.35em] text-xs mb-4">
              Aucune photo
            </p>
            {activeFilters.length > 0 && (
              <button
                onClick={() => setActiveFilters([])}
                className="text-cyan-300/50 hover:text-cyan-300 text-[10px] uppercase tracking-[0.25em] transition-colors"
              >
                Effacer les filtres →
              </button>
            )}
          </div>
        ) : (
          <div className="columns-1 md:columns-2 xl:columns-3 gap-x-6">
            {filteredPhotos.map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => { setSelectedPhoto(photo); setShowInfo(true); }}
                className="break-inside-avoid mb-6 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/3 backdrop-blur-md cursor-pointer transition-all duration-700 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/5 hover:shadow-[0_20px_80px_rgba(34,211,238,0.10)]"
              >
                <div className={`relative ${ASPECTS[index % ASPECTS.length]}`}>
                  <Image
                    src={imageUrl(photo.src)}
                    alt={photo.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    quality={imageProps("thumb").quality}
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
              </div>
            ))}
          </div>
        )}

        {/* Compteur */}
        {!loading && filteredPhotos.length > 0 && (
          <p className="text-center mt-10 text-white/20 text-[10px] uppercase tracking-[0.3em]">
            {filteredPhotos.length} photo{filteredPhotos.length > 1 ? "s" : ""}
            {activeFilters.length > 0 && ` · ${photos.length} au total`}
          </p>
        )}
      </div>

      {/* Visionneuse plein écran */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-100 bg-black/95 backdrop-blur-xl">
          <div className="absolute inset-0" onClick={() => setSelectedPhoto(null)} />

          <div className="fixed inset-0 flex items-center justify-center bg-linear-to-b from-black via-zinc-950 to-black">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedPhoto(null); }}
              className="absolute top-6 right-6 z-110 text-white/60 text-4xl hover:text-cyan-300 transition-all duration-300"
            >
              ✕
            </button>

            {/* Navigation précédent / suivant */}
            {filteredPhotos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = filteredPhotos.findIndex((p) => p.id === selectedPhoto.id);
                    setSelectedPhoto(filteredPhotos[(idx - 1 + filteredPhotos.length) % filteredPhotos.length]);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-110 text-white/40 hover:text-white text-3xl transition-all duration-300 px-2"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = filteredPhotos.findIndex((p) => p.id === selectedPhoto.id);
                    setSelectedPhoto(filteredPhotos[(idx + 1) % filteredPhotos.length]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-110 text-white/40 hover:text-white text-3xl transition-all duration-300 px-2"
                >
                  ›
                </button>
              </>
            )}

            <div
              className="relative w-screen h-dvh md:max-w-6xl md:h-[85vh]"
              onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
            >
              <Image
                src={imageUrl(selectedPhoto.src)}
                alt={selectedPhoto.title}
                fill
                sizes="100vw"
                quality={imageProps("medium").quality}
                className="object-contain select-none animate-[fadeIn_0.6s_ease]"
              />
            </div>

            {/* Compteur */}
            <div className="absolute top-6 left-6 z-110 text-white/40 text-[10px] uppercase tracking-[0.35em]">
              {String(filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) + 1).padStart(2, "0")}
              &nbsp;/&nbsp;
              {String(filteredPhotos.length).padStart(2, "0")}
            </div>

            {/* Infos photo */}
            {showInfo && (
              <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 max-w-xl bg-black/30 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.5)] transition-all duration-700">
                <h3 className="text-2xl md:text-4xl font-light uppercase tracking-[0.14em] text-white leading-tight">
                  {selectedPhoto.title}
                </h3>
                <div className="mt-2 text-cyan-300 uppercase tracking-[0.2em] text-xs">
                  {selectedPhoto.village}
                </div>
                {selectedPhoto.description && (
                  <p className="mt-3 text-white/50 leading-relaxed max-w-prose text-sm">
                    {selectedPhoto.description}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedPhoto.year && (
                    <span className="px-3 py-1.5 bg-white/10 border border-white/10 text-[10px] uppercase tracking-[0.2em]">
                      {selectedPhoto.year}
                    </span>
                  )}
                  {selectedPhoto.type && (
                    <span className="px-3 py-1.5 bg-white/10 border border-white/10 text-[10px] uppercase tracking-[0.2em]">
                      {selectedPhoto.type}
                    </span>
                  )}
                  {selectedPhoto.restored && (
                    <span className="px-3 py-1.5 bg-cyan-300 text-black text-[10px] uppercase tracking-[0.2em]">
                      Restaurée
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
