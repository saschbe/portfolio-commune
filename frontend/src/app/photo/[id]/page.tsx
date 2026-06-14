"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/imageUrl";
import ShareButtons from "@/components/ShareButtons";
import Temoignages from "@/components/Temoignages";
import type { User } from "@supabase/supabase-js";

const PhotoMap = dynamic(() => import("./PhotoMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-white/5 animate-pulse" />,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
  restored: boolean;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RAISONS: { value: string; label: string }[] = [
  { value: "personne_non_consentante", label: "Personne non consentante" },
  { value: "informations_incorrectes", label: "Informations incorrectes" },
  { value: "photo_non_conforme", label: "Photo non conforme" },
  { value: "violation_droits_auteur", label: "Violation de droits d'auteur" },
  { value: "autre", label: "Autre" },
];

const SWIPE_MIN_X = 80;
const SWIPE_MAX_Y = 60;

// ── Icons ─────────────────────────────────────────────────────────────────────

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
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function PhotoContent() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Context from query params (carte / galerie filtrée / accès direct)
  const searchParams = useSearchParams();
  const from = searchParams.get("from"); // "carte" | "galerie" | null
  const idsParam = searchParams.get("ids"); // IDs filtrés séparés par virgule | null

  // currentId drives what's displayed — updated via swipe without page reload
  const [currentId, setCurrentId] = useState(id);

  // Data
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [adjacentIds, setAdjacentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const preloadCache = useRef<Map<string, Photo>>(new Map());
  const imagePreloadCache = useRef<Set<string>>(new Set());

  // Slide animation direction (null = enter animation, 'left'/'right' = exit)
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  // Liste effective pour la navigation (selon le contexte)
  const navIds = useMemo<string[]>(() => {
    if (from === "galerie" && idsParam) return idsParam.split(",");
    return adjacentIds;
  }, [from, idsParam, adjacentIds]);

  const currentIndex = navIds.indexOf(currentId);
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId =
    currentIndex < navIds.length - 1 ? navIds[currentIndex + 1] : null;

  // Params à propager dans tous les liens prev/next
  const contextSearch = useMemo(() => {
    if (!from) return "";
    const p = new URLSearchParams({ from });
    if (idsParam) p.set("ids", idsParam);
    const v = searchParams.get("village");
    const h = searchParams.get("hameau");
    if (v) p.set("village", v);
    if (h) p.set("hameau", h);
    return `?${p.toString()}`;
  }, [from, idsParam, searchParams]);

  // Bouton retour adapté au contexte
  const backHref =
    from === "carte"
      ? "/carte"
      : from === "galerie"
        ? (() => {
            const p = new URLSearchParams();
            const v = searchParams.get("village");
            const h = searchParams.get("hameau");
            if (v) p.set("village", v);
            if (h) p.set("hameau", h);
            const s = p.toString();
            return s ? `/galerie?${s}` : "/galerie";
          })()
        : "/galerie";

  const backLabel = from === "carte" ? "← Carte" : "← Galerie";

  // Auth
  const [user, setUser] = useState<User | null>(null);

  // Zoom lightbox
  const [zoomed, setZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
  const headerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const enteredFullscreenRef = useRef(false);
  const zoomDragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  // Report modal
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRaison, setReportRaison] = useState("");
  const [reportPrecision, setReportPrecision] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportToken, setReportToken] = useState<string | null>(null);
  const reportTurnstileRef = useRef<TurnstileInstance>(null);

  // Swipe touch tracking (mobile)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeHappened = useRef(false);
  const lightboxSwipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const resetZoom = useCallback(() => {
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
  }, []);

  const closeZoom = useCallback(() => {
    setZoomed(false);
    resetZoom();

    if (enteredFullscreenRef.current && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    enteredFullscreenRef.current = false;
  }, [resetZoom]);

  const openZoom = useCallback(() => {
    resetZoom();
    setZoomed(true);

    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement
        .requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          enteredFullscreenRef.current = true;
        })
        .catch(() => {
          enteredFullscreenRef.current = false;
        });
    }
  }, [resetZoom]);

  const changeZoom = useCallback((delta: number) => {
    setZoomScale((current) => {
      const next = Math.min(4, Math.max(1, Number((current + delta).toFixed(2))));
      if (next === 1) setZoomPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // ── Navigate without page reload (mobile swipe) ───────────────────────────

  const navigateTo = useCallback(
    (targetId: string, dir: "left" | "right") => {
      setSlideDir(dir);
      setTimeout(() => {
        setCurrentId(targetId);
        setSlideDir(null);
        window.history.replaceState(
          null,
          "",
          `/photo/${targetId}${contextSearch}`,
        );
      }, 180);
    },
    [contextSearch],
  );

  // ── Sync currentId when URL id changes (Link clicks, browser back) ────────

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentId(id);
    });
  }, [id]);

  // ── Keyboard navigation (desktop — keeps router.push) ─────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (zoomed) {
          closeZoom();
          return;
        }
        if (reportOpen) {
          closeReport();
          return;
        }
      }
      if (zoomed) {
        if (e.key === "+" || e.key === "=") changeZoom(0.5);
        if (e.key === "-") changeZoom(-0.5);
        if (e.key === "0") resetZoom();
        return;
      }
      if (!zoomed && !reportOpen) {
        const idx = navIds.indexOf(currentId);
        if (e.key === "ArrowLeft" && idx > 0)
          router.push(`/photo/${navIds[idx - 1]}${contextSearch}`);
        if (e.key === "ArrowRight" && idx < navIds.length - 1)
          router.push(`/photo/${navIds[idx + 1]}${contextSearch}`);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    zoomed,
    reportOpen,
    navIds,
    contextSearch,
    currentId,
    router,
    closeZoom,
    changeZoom,
    resetZoom,
  ]);

  // ── Load adjacentIds once ─────────────────────────────────────────────────

  useEffect(() => {
    if (from === "galerie" && idsParam) return;
    supabase
      .from("photos")
      .select("id")
      .or("status.eq.approved,status.is.null")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAdjacentIds((data ?? []).map((p: { id: string }) => p.id));
      });
  }, [from, idsParam]);

  // ── Load photo data (cache-first) ─────────────────────────────────────────
  // setLoading(true) intentionally omitted here — the initial useState(true) covers
  // the first load. After that, stale photo stays visible during swipe transitions.

  useEffect(() => {
    const cached = preloadCache.current.get(currentId);
    if (cached) {
      setPhoto(cached);
      setNotFound(false);
      setLoading(false);
      return;
    }

    setNotFound(false);

    supabase
      .from("photos")
      .select("*")
      .eq("id", currentId)
      .single()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        preloadCache.current.set(currentId, data as Photo);
        setPhoto(data as Photo);
        setLoading(false);
      });
  }, [currentId]);

  // ── Preload nearby photos ─────────────────────────────────────────────────

  useEffect(() => {
    if (currentIndex < 0) return;

    const nearbyIds = [
      navIds[currentIndex - 2],
      prevId,
      nextId,
      navIds[currentIndex + 2],
    ].filter((pid): pid is string => Boolean(pid) && pid !== currentId);

    const preloadImage = (src: string | null | undefined) => {
      const url = imageUrl(src, "full");
      if (!url || imagePreloadCache.current.has(url)) return;
      imagePreloadCache.current.add(url);

      const img = new window.Image();
      img.decoding = "async";
      img.src = url;
    };

    nearbyIds.forEach((pid) => {
      preloadImage(preloadCache.current.get(pid)?.src);
    });

    const missingIds = nearbyIds.filter((pid) => !preloadCache.current.has(pid));
    if (missingIds.length === 0) return;

    supabase
      .from("photos")
      .select("*")
      .in("id", missingIds)
      .then(({ data }) => {
        (data ?? []).forEach((item) => {
          const loadedPhoto = item as Photo;
          preloadCache.current.set(loadedPhoto.id, loadedPhoto);
          preloadImage(loadedPhoto.src);
        });
      });
  }, [currentId, currentIndex, navIds, nextId, prevId]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // ── Report handlers ───────────────────────────────────────────────────────

  function closeReport() {
    setReportOpen(false);
    setReportRaison("");
    setReportPrecision("");
    setReportEmail("");
    setReportSuccess(false);
    setReportError("");
    setReportToken(null);
  }

  function openReport() {
    if (!user) {
      router.push(`/login?next=/photo/${currentId}`);
      return;
    }
    setReportOpen(true);
  }

  async function handleReport() {
    if (!photo || !reportRaison || !reportToken) return;
    setReportLoading(true);

    const verifyRes = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: reportToken }),
    });
    if (!verifyRes.ok) {
      setReportLoading(false);
      reportTurnstileRef.current?.reset();
      setReportToken(null);
      return;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: countError } = await supabase
      .from("signalements")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("created_at", oneHourAgo);

    if (!countError && (recentCount ?? 0) >= 3) {
      setReportError(
        "Limite atteinte : vous ne pouvez pas envoyer plus de 3 signalements par heure.",
      );
      setReportLoading(false);
      return;
    }

    const { error } = await supabase.from("signalements").insert({
      photo_id: photo.id,
      raison: reportRaison,
      details: reportPrecision.trim() || null,
      email: reportEmail.trim() || null,
      user_id: user!.id,
    });

    if (!error) {
      supabase.from("photos").update({ status: "signaled" }).eq("id", photo.id);
      setReportSuccess(true);
      setTimeout(closeReport, 2500);
    }
    setReportLoading(false);
  }

  useEffect(() => {
    if (loading || notFound) return;
    const header = headerRef.current;
    if (!header) return;

    const setHeaderHeight = (height: number) => {
      document.documentElement.style.setProperty(
        "--photo-header-height",
        `${height}px`,
      );
    };

    setHeaderHeight(header.getBoundingClientRect().height);

    const ro = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height);
    });
    ro.observe(header);

    return () => ro.disconnect();
  }, [loading, notFound]);

  // ── Loading / not-found states ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/20 uppercase tracking-[0.35em] text-xs">
          Chargement…
        </p>
      </div>
    );
  }

  if (notFound || !photo) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <p className="text-white/20 uppercase tracking-[0.35em] text-xs">
          Photo introuvable
        </p>
        <Link
          href="/galerie"
          className="px-6 py-2.5 rounded-full border border-white/10 text-white/40 text-xs uppercase tracking-[0.25em] hover:border-white/20 hover:text-white/60 transition-all duration-300"
        >
          ← Retour à la galerie
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const animClass =
    slideDir === "left"
      ? "animate-slideOutLeft"
      : slideDir === "right"
        ? "animate-slideOutRight"
        : "animate-slideIn";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header ref={headerRef} className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-17.5 flex items-center justify-between gap-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo-white.png"
              alt="Plombières en Images"
              width={0}
              height={0}
              sizes="100vw"
              className="w-32.5 md:w-40 h-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
              priority
            />
          </Link>

          <div className="flex items-center gap-6">
            {(prevId || nextId) && (
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  href={prevId ? `/photo/${prevId}${contextSearch}` : "#"}
                  aria-disabled={!prevId}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    prevId
                      ? "border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
                      : "border-white/5 text-white/15 pointer-events-none"
                  }`}
                >
                  <ChevronLeft />
                </Link>
                <Link
                  href={nextId ? `/photo/${nextId}${contextSearch}` : "#"}
                  aria-disabled={!nextId}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    nextId
                      ? "border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
                      : "border-white/5 text-white/15 pointer-events-none"
                  }`}
                >
                  <ChevronRight />
                </Link>
              </div>
            )}

            <Link
              href={backHref}
              className="text-white/40 text-xs uppercase tracking-[0.25em] hover:text-white/70 transition-colors duration-300"
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="pt-[var(--photo-header-height)] pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 lg:py-14">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 xl:gap-14 items-start">
            {/* ── Colonne gauche — photo + titre mobile ────────── */}
            <div className="space-y-4">
              <div className={animClass}>
                {/* Titre mobile (affiché avant la photo) */}
                <div className="lg:hidden space-y-4 mb-4">
                  {photo.restored && (
                    <span className="inline-block px-3 py-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.3em]">
                      Photo restaurée
                    </span>
                  )}
                  <h1 className="text-2xl font-light uppercase tracking-[0.15em] leading-snug">
                    {photo.title}
                  </h1>
                  <div className="space-y-3">
                    {photo.village && (
                      <div className="flex items-baseline gap-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">
                          Village
                        </span>
                        <span className="text-sm text-white/70">
                          {photo.village}
                        </span>
                      </div>
                    )}
                    {photo.year && (
                      <div className="flex items-baseline gap-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">
                          Année
                        </span>
                        <span className="text-sm text-white/70">
                          {photo.year}
                        </span>
                      </div>
                    )}
                    {photo.type && (
                      <div className="flex items-baseline gap-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">
                          Type
                        </span>
                        <span className="text-sm text-white/70 capitalize">
                          {photo.type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photo principale */}
                <div
                  className="relative w-full aspect-3/2 lg:aspect-auto lg:h-[calc(100vh_-_var(--photo-header-height)_-_130px)] rounded-2xl overflow-hidden border border-white/10 cursor-zoom-in group"
                  onClick={() => {
                    if (swipeHappened.current) {
                      swipeHappened.current = false;
                      return;
                    }
                    openZoom();
                  }}
                  onTouchStart={(e) => {
                    touchStartX.current = e.touches[0].clientX;
                    touchStartY.current = e.touches[0].clientY;
                    swipeHappened.current = false;
                  }}
                  onTouchEnd={(e) => {
                    const dx =
                      e.changedTouches[0].clientX - touchStartX.current;
                    const dy =
                      e.changedTouches[0].clientY - touchStartY.current;
                    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
                    if (
                      Math.abs(dx) >= SWIPE_MIN_X &&
                      Math.abs(dy) < SWIPE_MAX_Y
                    ) {
                      swipeHappened.current = true;
                      if (dx < 0 && nextId) navigateTo(nextId, "left");
                      if (dx > 0 && prevId) navigateTo(prevId, "right");
                    }
                  }}
                >
                  <Image
                    src={imageUrl(photo.src, "full")}
                    alt={photo.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.01]"
                    priority
                  />
                  {/* Gradient + hint au survol */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <span className="px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg border border-white/10 text-white/55 text-[10px] uppercase tracking-[0.2em]">
                      ⊕ Agrandir
                    </span>
                  </div>

                  {/* Compteur X / Y */}
                  {navIds.length > 1 && currentIndex >= 0 && (
                    <div className="absolute bottom-3 left-3 pointer-events-none">
                      <span className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-sm border border-white/10 text-white/50 text-[10px] uppercase tracking-[0.2em] tabular-nums">
                        {currentIndex + 1} / {navIds.length}
                      </span>
                    </div>
                  )}

                  {/* Points de navigation + chevrons — mobile uniquement */}
                  {navIds.length > 1 && currentIndex >= 0 && (
                    <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 lg:hidden pointer-events-none">
                      <span
                        className={`text-sm ${prevId ? "text-white/50" : "text-white/20"}`}
                      >
                        ‹
                      </span>
                      {(() => {
                        const total = navIds.length;
                        const maxDots = 5;
                        const count = Math.min(maxDots, total);
                        const start =
                          total <= maxDots
                            ? 0
                            : Math.max(
                                0,
                                Math.min(currentIndex - 2, total - maxDots),
                              );
                        return Array.from({ length: count }, (_, i) => {
                          const dotIdx = start + i;
                          return (
                            <span
                              key={dotIdx}
                              className={
                                dotIdx === currentIndex
                                  ? "w-3.5 h-1.5 rounded-full bg-cyan-300"
                                  : "w-1.5 h-1.5 rounded-full bg-white/25"
                              }
                            />
                          );
                        });
                      })()}
                      <span
                        className={`text-sm ${nextId ? "text-white/50" : "text-white/20"}`}
                      >
                        ›
                      </span>
                    </div>
                  )}

                  {/* Bouton zoom permanent — mobile uniquement */}
                  <button
                    className="absolute bottom-3 right-3 lg:hidden w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/60 text-sm z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      openZoom();
                    }}
                    aria-label="Agrandir"
                  >
                    ⊕
                  </button>

                  {/* Flèche gauche */}
                  {prevId && (
                    <Link
                      href={`/photo/${prevId}${contextSearch}`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-all duration-200"
                      aria-label="Photo précédente"
                    >
                      <ChevronLeft />
                    </Link>
                  )}

                  {/* Flèche droite */}
                  {nextId && (
                    <Link
                      href={`/photo/${nextId}${contextSearch}`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-all duration-200"
                      aria-label="Photo suivante"
                    >
                      <ChevronRight />
                    </Link>
                  )}

                  {/* Drapeau signalement — coin supérieur droit */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openReport();
                    }}
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/50 hover:text-red-400 hover:border-red-400/40 transition-all duration-200"
                    aria-label="Signaler cette photo"
                    title="Signaler cette photo"
                  >
                    <FlagIcon />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Panneau info ─────────────────────────────────── */}
            <div className="lg:sticky lg:top-[calc(var(--photo-header-height)_+_1rem)] space-y-6">
              {/* Animé : titre desktop + métadonnées + description */}
              <div className={animClass}>
                {/* Badge + Titre + Métadonnées — masqués sur mobile */}
                <div className="hidden lg:block space-y-6">
                  {photo.restored && (
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.3em]">
                        Photo restaurée
                      </span>
                    </div>
                  )}
                  <h1 className="text-2xl lg:text-3xl font-light uppercase tracking-[0.15em] leading-snug">
                    {photo.title}
                  </h1>
                  <div className="space-y-3">
                    {photo.village && (
                      <div className="flex items-baseline gap-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">
                          Village
                        </span>
                        <span className="text-sm text-white/70">
                          {photo.village}
                        </span>
                      </div>
                    )}
                    {photo.year && (
                      <div className="flex items-baseline gap-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">
                          Année
                        </span>
                        <span className="text-sm text-white/70">
                          {photo.year}
                        </span>
                      </div>
                    )}
                    {photo.type && (
                      <div className="flex items-baseline gap-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">
                          Type
                        </span>
                        <span className="text-sm text-white/70 capitalize">
                          {photo.type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                {photo.description && (
                  <div className="border-t border-white/5 pt-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 mb-3">
                      Description
                    </p>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {photo.description}
                    </p>
                  </div>
                )}

              </div>

              {/* Non animé : mini carte */}
              {photo.latitude != null && photo.longitude != null ? (
                <div className="border-t border-white/5 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                      Localisation
                    </p>
                    <Link
                      href="/carte"
                      className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/50 hover:text-cyan-300 transition-colors duration-200"
                    >
                      Carte complète →
                    </Link>
                  </div>
                  <div className="w-full h-36 md:h-52 rounded-xl overflow-hidden border border-white/10">
                    <PhotoMap
                      latitude={photo.latitude}
                      longitude={photo.longitude}
                    />
                  </div>
                  <div className="mt-5 pt-5 border-t border-white/5">
                    <ShareButtons
                      url={`https://www.photoplombieres.eu/photo/${photo.id}`}
                      title={photo.title}
                    />
                  </div>
                </div>
              ) : (
                <div className="border-t border-white/5 pt-5">
                  <ShareButtons
                    url={`https://www.photoplombieres.eu/photo/${photo.id}`}
                    title={photo.title}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Témoignages en pleine largeur sous la grille */}
          <div className="mt-12 max-w-3xl mx-auto">
            <Temoignages photoId={photo.id} />
          </div>
        </div>
      </main>

      {/* ── Zoom lightbox ─────────────────────────────────────────────── */}
      {zoomed && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] bg-black/96 backdrop-blur-sm"
          onClick={closeZoom}
        >
          <div
            className="photo-lightbox-controls absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 p-1.5 text-white/70 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => changeZoom(-0.5)}
              disabled={zoomScale <= 1}
              aria-label="Reduire le zoom"
              title="Reduire le zoom"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg leading-none transition-all duration-200 hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              -
            </button>
            <span className="w-14 text-center text-[10px] uppercase tracking-[0.18em] tabular-nums text-white/50">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => changeZoom(0.5)}
              disabled={zoomScale >= 4}
              aria-label="Agrandir le zoom"
              title="Agrandir le zoom"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg leading-none transition-all duration-200 hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              +
            </button>
            <button
              onClick={resetZoom}
              disabled={zoomScale === 1 && zoomPan.x === 0 && zoomPan.y === 0}
              aria-label="Revenir a 100%"
              title="Revenir a 100%"
              className="h-9 rounded-full border border-white/10 bg-white/5 px-3 text-[10px] uppercase tracking-[0.18em] transition-all duration-200 hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              1:1
            </button>
          </div>
          <button
            onClick={closeZoom}
            aria-label="Fermer et revenir a la description"
            title="Fermer et revenir a la description"
            className="photo-lightbox-close absolute top-4 right-4 z-30 w-11 h-11 rounded-full border border-white/35 bg-black/85 shadow-[0_6px_24px_rgba(0,0,0,0.75)] ring-1 ring-black/60 flex items-center justify-center text-white hover:bg-black hover:border-white/70 transition-all duration-200"
          >
            ✕
          </button>
          {/* touch-action: pinch-zoom pour le zoom natif mobile */}
          <div
            className="photo-lightbox-stage flex h-full w-full items-center justify-center overflow-hidden px-3 py-18 sm:px-8"
            style={{ touchAction: zoomScale > 1 ? "none" : "pan-y" }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.preventDefault();
              changeZoom(e.deltaY > 0 ? -0.25 : 0.25);
            }}
            onDoubleClick={() => {
              if (zoomScale === 1) changeZoom(1);
              else resetZoom();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              if (zoomScale <= 1) {
                lightboxSwipeRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  moved: false,
                };
                return;
              }
              zoomDragRef.current = {
                active: true,
                moved: false,
                startX: e.clientX,
                startY: e.clientY,
                originX: zoomPan.x,
                originY: zoomPan.y,
              };
            }}
            onPointerMove={(e) => {
              if (lightboxSwipeRef.current.active && zoomScale <= 1) {
                const dx = e.clientX - lightboxSwipeRef.current.startX;
                const dy = e.clientY - lightboxSwipeRef.current.startY;
                if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                  lightboxSwipeRef.current.moved = true;
                }
                if (Math.abs(dx) > Math.abs(dy)) {
                  e.preventDefault();
                }
                return;
              }
              if (!zoomDragRef.current.active || zoomScale <= 1) return;
              const dx = e.clientX - zoomDragRef.current.startX;
              const dy = e.clientY - zoomDragRef.current.startY;
              if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                zoomDragRef.current.moved = true;
              }
              setZoomPan({
                x: zoomDragRef.current.originX + dx,
                y: zoomDragRef.current.originY + dy,
              });
            }}
            onPointerUp={(e) => {
              if (lightboxSwipeRef.current.active && zoomScale <= 1) {
                const dx = e.clientX - lightboxSwipeRef.current.startX;
                const dy = e.clientY - lightboxSwipeRef.current.startY;
                lightboxSwipeRef.current.active = false;
                e.currentTarget.releasePointerCapture(e.pointerId);
                if (
                  Math.abs(dx) >= SWIPE_MIN_X &&
                  Math.abs(dy) < SWIPE_MAX_Y
                ) {
                  if (dx < 0 && nextId) navigateTo(nextId, "left");
                  if (dx > 0 && prevId) navigateTo(prevId, "right");
                }
                return;
              }
              zoomDragRef.current.active = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={(e) => {
              lightboxSwipeRef.current.active = false;
              zoomDragRef.current.active = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          >
            <div className={animClass}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(photo.src, "full")}
                alt={photo.title}
                draggable={false}
                className="photo-lightbox-image select-none transition-transform duration-150 ease-out"
                style={{
                  display: "block",
                  maxWidth: "min(2400px, 95vw)",
                  maxHeight: "calc(100dvh - 8rem)",
                  objectFit: "contain",
                  cursor: zoomScale > 1 ? "grab" : "default",
                  transform: `translate3d(${zoomPan.x}px, ${zoomPan.y}px, 0) scale(${zoomScale})`,
                  touchAction: zoomScale > 1 ? "none" : "pan-y",
                }}
              />
            </div>
          </div>
          {/* Hint clavier */}
          <p className="photo-lightbox-hint absolute bottom-4 left-1/2 -translate-x-1/2 text-white/20 text-[10px] uppercase tracking-[0.25em]">
            <span className="hidden md:inline">Échap pour fermer</span>
            <span className="md:hidden">Appuyer pour fermer</span>
          </p>
        </div>
      )}

      {/* ── Modale signalement ────────────────────────────────────────── */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeReport}
        >
          <div
            className="bg-zinc-950 border border-white/10 rounded-3xl p-5 sm:p-8 w-full max-w-md shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[90dvh]"
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
                      {photo.title}
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/7 transition-all duration-200 resize-none max-h-24"
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

                <div className="overflow-hidden flex justify-center mt-4">
                  <Turnstile
                    ref={reportTurnstileRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={(token) => {
                      setReportToken(token);
                      setReportError("");
                    }}
                    onExpire={() => setReportToken(null)}
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
                    disabled={!reportRaison || reportLoading || !reportToken}
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

      {/* ── Barre navigation mobile sticky ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black border-t border-white/10 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between lg:hidden">
        {prevId ? (
          <Link
            href={`/photo/${prevId}${contextSearch}`}
            className="flex-1 flex items-center gap-2 h-11 text-white/50 text-xs uppercase tracking-[0.2em] hover:text-white/80 transition-colors duration-200"
          >
            <ChevronLeft /> Précédente
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {currentIndex >= 0 && navIds.length > 1 && (
          <span className="text-white/30 text-xs uppercase tracking-[0.25em] tabular-nums px-4">
            {currentIndex + 1} / {navIds.length}
          </span>
        )}
        {nextId ? (
          <Link
            href={`/photo/${nextId}${contextSearch}`}
            className="flex-1 flex items-center justify-end gap-2 h-11 text-white/50 text-xs uppercase tracking-[0.2em] hover:text-white/80 transition-colors duration-200"
          >
            Suivante <ChevronRight />
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}

export default function PhotoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PhotoContent />
    </Suspense>
  );
}
