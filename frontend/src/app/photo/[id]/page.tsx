"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabase";
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
  { value: "photo_non_conforme",       label: "Photo non conforme" },
  { value: "violation_droits_auteur",  label: "Violation de droits d'auteur" },
  { value: "autre",                    label: "Autre" },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function FlagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PhotoPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Data
  const [photo, setPhoto]           = useState<Photo | null>(null);
  const [adjacentIds, setAdjacentIds] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);

  // Auth
  const [user, setUser] = useState<User | null>(null);

  // Zoom lightbox
  const [zoomed, setZoomed] = useState(false);

  // Report modal
  const [reportOpen, setReportOpen]         = useState(false);
  const [reportRaison, setReportRaison]     = useState("");
  const [reportPrecision, setReportPrecision] = useState("");
  const [reportEmail, setReportEmail]       = useState("");
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportSuccess, setReportSuccess]   = useState(false);
  const [reportError, setReportError]       = useState("");
  const [reportToken, setReportToken]       = useState<string | null>(null);
  const reportTurnstileRef                  = useRef<TurnstileInstance>(null);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (zoomed)      { setZoomed(false); return; }
        if (reportOpen)  { closeReport();    return; }
      }
      if (!zoomed && !reportOpen) {
        const idx = adjacentIds.indexOf(id);
        if (e.key === "ArrowLeft"  && idx > 0)
          router.push(`/photo/${adjacentIds[idx - 1]}`);
        if (e.key === "ArrowRight" && idx < adjacentIds.length - 1)
          router.push(`/photo/${adjacentIds[idx + 1]}`);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed, reportOpen, adjacentIds, id, router]);

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);

      const [{ data: photoData }, { data: allData }] = await Promise.all([
        supabase.from("photos").select("*").eq("id", id).single(),
        supabase
          .from("photos")
          .select("id")
          .or("status.eq.approved,status.is.null")
          .order("created_at", { ascending: false }),
      ]);

      if (!photoData) { setNotFound(true); setLoading(false); return; }
      setPhoto(photoData as Photo);
      setAdjacentIds((allData ?? []).map((p: { id: string }) => p.id));
      setLoading(false);
    }
    load();
  }, [id]);

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
    if (!user) { router.push(`/login?next=/photo/${id}`); return; }
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
      setReportError("Limite atteinte : vous ne pouvez pas envoyer plus de 3 signalements par heure.");
      setReportLoading(false);
      return;
    }

    const { error } = await supabase.from("signalements").insert({
      photo_id: photo.id,
      raison:   reportRaison,
      details:  reportPrecision.trim() || null,
      email:    reportEmail.trim()     || null,
      user_id:  user!.id,
    });

    if (!error) {
      supabase.from("photos").update({ status: "signaled" }).eq("id", photo.id);
      setReportSuccess(true);
      setTimeout(closeReport, 2500);
    }
    setReportLoading(false);
  }

  // ── Derived navigation values ─────────────────────────────────────────────

  const currentIndex = adjacentIds.indexOf(id);
  const prevId = currentIndex > 0 ? adjacentIds[currentIndex - 1] : null;
  const nextId = currentIndex < adjacentIds.length - 1 ? adjacentIds[currentIndex + 1] : null;

  // ── Loading / not-found states ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/20 uppercase tracking-[0.35em] text-xs">Chargement…</p>
      </div>
    );
  }

  if (notFound || !photo) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <p className="text-white/20 uppercase tracking-[0.35em] text-xs">Photo introuvable</p>
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

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-[70px] flex items-center justify-between gap-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo-white.png"
              alt="Plombières en Images"
              width={0} height={0}
              sizes="100vw"
              className="w-[130px] md:w-[190px] lg:w-[260px] h-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
              priority
            />
          </Link>

          <div className="flex items-center gap-6">
            {/* Navigation rapide dans le header */}
            {(prevId || nextId) && (
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  href={prevId ? `/photo/${prevId}` : "#"}
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
                  href={nextId ? `/photo/${nextId}` : "#"}
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
              href="/galerie"
              className="text-white/40 text-xs uppercase tracking-[0.25em] hover:text-white/70 transition-colors duration-300"
            >
              ← Galerie
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="pt-[70px]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 lg:py-14">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 xl:gap-14 items-start">

            {/* ── Image + navigation ───────────────────────── */}
            <div className="space-y-4">

              {/* Photo principale */}
              <div
                className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] cursor-zoom-in group"
                onClick={() => setZoomed(true)}
              >
                <Image
                  src={photo.src}
                  alt={photo.title}
                  width={1400}
                  height={950}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.01]"
                  priority
                />
                {/* Gradient + hint au survol */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <span className="px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg border border-white/10 text-white/55 text-[10px] uppercase tracking-[0.2em]">
                    ⊕ Agrandir
                  </span>
                </div>
              </div>

              {/* Navigation précédente / suivante */}
              <div className="flex items-center justify-between px-1">
                {prevId ? (
                  <Link
                    href={`/photo/${prevId}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white/40 text-xs uppercase tracking-[0.2em] hover:border-white/20 hover:text-white/70 transition-all duration-300"
                  >
                    <ChevronLeft /> Précédente
                  </Link>
                ) : <div />}

                {currentIndex >= 0 && adjacentIds.length > 1 && (
                  <span className="text-white/20 text-[10px] uppercase tracking-[0.25em] tabular-nums">
                    {currentIndex + 1} <span className="text-white/10 mx-1">/</span> {adjacentIds.length}
                  </span>
                )}

                {nextId ? (
                  <Link
                    href={`/photo/${nextId}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white/40 text-xs uppercase tracking-[0.2em] hover:border-white/20 hover:text-white/70 transition-all duration-300"
                  >
                    Suivante <ChevronRight />
                  </Link>
                ) : <div />}
              </div>
            </div>

            {/* ── Panneau info ─────────────────────────────── */}
            <div className="lg:sticky lg:top-[86px] space-y-6">

              {/* Badge restaurée */}
              {photo.restored && (
                <div>
                  <span className="inline-block px-3 py-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.3em]">
                    Photo restaurée
                  </span>
                </div>
              )}

              {/* Titre */}
              <h1 className="text-2xl lg:text-3xl font-light uppercase tracking-[0.15em] leading-snug">
                {photo.title}
              </h1>

              {/* Métadonnées */}
              <div className="space-y-3">
                {photo.village && (
                  <div className="flex items-baseline gap-4">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">Village</span>
                    <span className="text-sm text-white/70">{photo.village}</span>
                  </div>
                )}
                {photo.year && (
                  <div className="flex items-baseline gap-4">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">Année</span>
                    <span className="text-sm text-white/70">{photo.year}</span>
                  </div>
                )}
                {photo.type && (
                  <div className="flex items-baseline gap-4">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 w-14 shrink-0 pt-0.5">Type</span>
                    <span className="text-sm text-white/70 capitalize">{photo.type}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {photo.description && (
                <div className="border-t border-white/5 pt-5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 mb-3">Description</p>
                  <p className="text-sm text-white/60 leading-relaxed">{photo.description}</p>
                </div>
              )}

              {/* Mini carte */}
              {photo.latitude != null && photo.longitude != null && (
                <div className="border-t border-white/5 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">Localisation</p>
                    <Link
                      href="/carte"
                      className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/50 hover:text-cyan-300 transition-colors duration-200"
                    >
                      Carte complète →
                    </Link>
                  </div>
                  <div className="w-full h-52 rounded-xl overflow-hidden border border-white/10">
                    <PhotoMap latitude={photo.latitude} longitude={photo.longitude} />
                  </div>
                </div>
              )}

              {/* Bouton signaler */}
              <div className="border-t border-white/5 pt-5">
                <button
                  onClick={openReport}
                  className="flex items-center gap-2 text-white/25 hover:text-white/50 text-[10px] uppercase tracking-[0.2em] transition-colors duration-300"
                >
                  <FlagIcon />
                  Signaler cette photo
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Zoom lightbox ─────────────────────────────────────────────── */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-black/96 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            aria-label="Fermer"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all duration-200"
          >
            ✕
          </button>
          {/* touch-action: pinch-zoom pour le zoom natif mobile */}
          <div
            className="overflow-auto cursor-zoom-out"
            style={{ maxWidth: "95vw", maxHeight: "95vh", touchAction: "pinch-zoom" }}
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={photo.title}
              style={{
                display: "block",
                maxWidth: "min(2400px, 95vw)",
                maxHeight: "95vh",
                objectFit: "contain",
              }}
            />
          </div>
          {/* Hint clavier */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/20 text-[10px] uppercase tracking-[0.25em]">
            Échap pour fermer
          </p>
        </div>
      )}

      {/* ── Modale signalement ────────────────────────────────────────── */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeReport}
        >
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
                    <p className="text-white text-sm font-light truncate max-w-[260px]">{photo.title}</p>
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
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
                      Précision{" "}
                      <span className="text-white/25 normal-case tracking-normal">optionnel</span>
                    </label>
                    <textarea
                      value={reportPrecision}
                      onChange={(e) => setReportPrecision(e.target.value)}
                      rows={3}
                      placeholder="Décrivez le problème…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
                      Email{" "}
                      <span className="text-white/25 normal-case tracking-normal">optionnel — pour être recontacté</span>
                    </label>
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
                    onSuccess={(token) => { setReportToken(token); setReportError(""); }}
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
    </div>
  );
}
