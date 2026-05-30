"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { VILLAGES_HAMEAUX, VILLAGES } from "@/lib/villages";
import { logActivite } from "@/lib/logActivite";

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotoEntry = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  village: string;
  hameau: string;
  year: string;
  type: string;
  description: string;
  restored: boolean;
  latitude: string;
  longitude: string;
  status: "idle" | "uploading" | "success" | "error";
  errorMsg: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPES = ["Ancienne", "Moderne", "Aérienne", "Événement"] as const;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILES = 20;
const MAX_SIZE  = 10 * 1024 * 1024;

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadSection() {
  const [entries, setEntries]         = useState<PhotoEntry[]>([]);
  const [isDragging, setIsDragging]   = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  // "Appliquer à toutes" toolbar state (one-shot selects)
  const [applyVillage, setApplyVillage] = useState("");
  const [applyYear, setApplyYear]       = useState("");
  const [applyType, setApplyType]       = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const entriesRef   = useRef<PhotoEntry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => { entriesRef.current.forEach(e => URL.revokeObjectURL(e.previewUrl)); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const readyCount   = entries.filter(e => e.title.trim() && e.village.trim() && e.status === "idle").length;
  const successCount = entries.filter(e => e.status === "success").length;

  // ── File handling ─────────────────────────────────────────────────────────

  function handleFiles(files: File[]) {
    const valid = files.filter(f => ACCEPTED.includes(f.type));
    if (entries.length + valid.length > MAX_FILES) {
      setGlobalError("Maximum 20 photos à la fois");
      return;
    }
    setGlobalError("");

    const newEntries: PhotoEntry[] = valid.map(file => ({
      id:          crypto.randomUUID(),
      file,
      previewUrl:  URL.createObjectURL(file),
      title:       "",
      village:     "",
      hameau:      "",
      year:        "",
      type:        "",
      description: "",
      restored:    false,
      latitude:    "",
      longitude:   "",
      status:      file.size > MAX_SIZE ? "error" : "idle",
      errorMsg:    file.size > MAX_SIZE ? "Fichier trop volumineux (max. 10 Mo)" : "",
    }));

    setEntries(prev => [...prev, ...newEntries]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }

  // ── Entry helpers ─────────────────────────────────────────────────────────

  function updateEntry(id: string, patch: Partial<PhotoEntry>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function removeEntry(id: string) {
    setEntries(prev => {
      const entry = prev.find(e => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter(e => e.id !== id);
    });
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function uploadEntry(entry: PhotoEntry, userId: string | undefined) {
    updateEntry(entry.id, { status: "uploading" });
    try {
      const ext  = entry.file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("photos")
        .upload(path, entry.file, { cacheControl: "3600", upsert: false });
      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);

      const { data: inserted, error: dbError } = await supabase.from("photos").insert({
        title:       entry.title.trim(),
        village:     entry.village,
        hameau:      entry.hameau  || null,
        year:        entry.year    || null,
        type:        entry.type    || null,
        description: entry.description || null,
        restored:    entry.restored,
        latitude:    entry.latitude  ? parseFloat(entry.latitude)  : null,
        longitude:   entry.longitude ? parseFloat(entry.longitude) : null,
        src:         publicUrl,
        status:      "approved",
        user_id:     userId ?? null,
      }).select("id").single();
      if (dbError) throw dbError;

      await logActivite({
        type:        "photo_importee",
        description: `Photo importée : "${entry.title.trim()}" (${entry.village})`,
        photo_id:    inserted?.id,
        actor_id:    userId,
        meta: {
          title:   entry.title.trim(),
          village: entry.village,
          hameau:  entry.hameau  || null,
          year:    entry.year    || null,
          type:    entry.type    || null,
        },
      });

      updateEntry(entry.id, { status: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      updateEntry(entry.id, { status: "error", errorMsg: msg });
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const ready = entries.filter(e => e.title.trim() && e.village.trim() && e.status === "idle");
    for (let i = 0; i < ready.length; i += 4) {
      await Promise.all(ready.slice(i, i + 4).map(e => uploadEntry(e, userId)));
    }
    setSubmitting(false);
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const fieldClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 " +
    "text-white text-xs uppercase tracking-[0.15em] " +
    "placeholder:text-white/20 focus:outline-none focus:border-cyan-300/40 transition-all";

  const toolbarSelectClass =
    "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 " +
    "text-[10px] uppercase tracking-[0.15em] text-white/60 " +
    "focus:outline-none focus:border-cyan-300/30 transition-all cursor-pointer [&>option]:bg-zinc-900";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white/80 uppercase tracking-[0.35em] text-xs mb-1">Importer des photos</h2>
        <p className="text-white/30 text-[10px] uppercase tracking-[0.2em]">
          Photos ajoutées directement avec statut approuvé
        </p>
      </div>

      {/* ── Zone de dépôt ──────────────────────────────────────────────── */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-cyan-300/50 bg-cyan-300/5"
            : "border-white/15 hover:border-cyan-300/30 hover:bg-white/[0.02]"
        }`}
      >
        <p className="text-3xl mb-3 text-white/30">↑</p>
        <p className="text-white/70 text-sm uppercase tracking-[0.2em] mb-2">
          Glissez vos photos ici
        </p>
        <p className="text-white/30 text-[11px] uppercase tracking-[0.15em] mb-4">
          ou cliquez pour sélectionner (max. {MAX_FILES} fichiers)
        </p>
        <p className="text-white/20 text-[10px] uppercase tracking-[0.2em]">
          Formats : JPG, PNG, WEBP · Max. 10 Mo par fichier
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) handleFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {globalError && (
        <p className="text-red-400 text-xs uppercase tracking-[0.2em]">{globalError}</p>
      )}

      {/* ── Appliquer à toutes ─────────────────────────────────────────── */}
      {entries.length >= 2 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 shrink-0">
            Appliquer à toutes :
          </span>

          <select
            value={applyVillage}
            onChange={e => {
              const v = e.target.value;
              if (!v) return;
              setEntries(prev => prev.map(entry =>
                entry.village ? entry : { ...entry, village: v, hameau: "" }
              ));
              setApplyVillage("");
            }}
            className={toolbarSelectClass}
          >
            <option value="">Village ▾</option>
            {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <input
            type="text"
            value={applyYear}
            onChange={e => setApplyYear(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && applyYear.trim()) {
                setEntries(prev => prev.map(entry =>
                  entry.year ? entry : { ...entry, year: applyYear.trim() }
                ));
                setApplyYear("");
              }
            }}
            placeholder="Année ↵"
            maxLength={4}
            className={`${toolbarSelectClass} w-24`}
          />

          <select
            value={applyType}
            onChange={e => {
              const v = e.target.value;
              if (!v) return;
              setEntries(prev => prev.map(entry =>
                entry.type ? entry : { ...entry, type: v }
              ));
              setApplyType("");
            }}
            className={toolbarSelectClass}
          >
            <option value="">Type ▾</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* ── Grille de cartes ───────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entries.map(entry => {
            const hameaux       = VILLAGES_HAMEAUX[entry.village] ?? [];
            const hameauDisabled = !entry.village || hameaux.length === 0;

            return (
              <div key={entry.id} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">

                {/* Aperçu photo */}
                <div className="relative h-40 w-full overflow-hidden bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.previewUrl}
                    alt={entry.title || "Aperçu"}
                    className="w-full h-full object-cover opacity-80"
                  />

                  {/* Bouton supprimer */}
                  <button
                    onClick={() => removeEntry(entry.id)}
                    aria-label="Supprimer"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/10 text-white/50 hover:text-red-400 flex items-center justify-center text-xs transition-colors"
                  >
                    ✕
                  </button>

                  {/* Overlays de statut */}
                  {entry.status === "uploading" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-300/70 animate-pulse" />
                  )}
                  {entry.status === "success" && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/30 text-emerald-400 text-[10px] uppercase tracking-[0.2em]">
                        ✓ Importée
                      </span>
                    </div>
                  )}
                  {entry.status === "error" && (
                    <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                      <span className="px-2.5 py-1 rounded-full bg-red-400/20 border border-red-400/30 text-red-400 text-[10px] uppercase tracking-[0.15em] text-center leading-tight">
                        {entry.errorMsg || "Erreur"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Champs du formulaire */}
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={entry.title}
                    onChange={e => updateEntry(entry.id, { title: e.target.value })}
                    placeholder="TITRE DE LA PHOTO"
                    className={fieldClass}
                  />

                  <select
                    value={entry.village}
                    onChange={e => updateEntry(entry.id, { village: e.target.value, hameau: "" })}
                    className={`${fieldClass} [&>option]:bg-zinc-900 cursor-pointer`}
                  >
                    <option value="">◦ Village</option>
                    {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>

                  <select
                    value={entry.hameau}
                    onChange={e => updateEntry(entry.id, { hameau: e.target.value })}
                    disabled={hameauDisabled}
                    className={`${fieldClass} [&>option]:bg-zinc-900 ${hameauDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <option value="">◦ Hameau (optionnel)</option>
                    {hameaux.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>

                  <input
                    type="text"
                    value={entry.year}
                    onChange={e => updateEntry(entry.id, { year: e.target.value })}
                    placeholder="ANNÉE (ex. 1923)"
                    maxLength={4}
                    className={fieldClass}
                  />

                  <select
                    value={entry.type}
                    onChange={e => updateEntry(entry.id, { type: e.target.value })}
                    className={`${fieldClass} [&>option]:bg-zinc-900 cursor-pointer`}
                  >
                    <option value="">◦ Type</option>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <textarea
                    value={entry.description}
                    onChange={e => updateEntry(entry.id, { description: e.target.value })}
                    rows={2}
                    placeholder="DESCRIPTION…"
                    className={`${fieldClass} resize-none`}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={entry.latitude}
                      onChange={e => updateEntry(entry.id, { latitude: e.target.value })}
                      placeholder="LATITUDE"
                      className={`${fieldClass} text-[10px]`}
                    />
                    <input
                      type="text"
                      value={entry.longitude}
                      onChange={e => updateEntry(entry.id, { longitude: e.target.value })}
                      placeholder="LONGITUDE"
                      className={`${fieldClass} text-[10px]`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => updateEntry(entry.id, { restored: !entry.restored })}
                    className={`w-full rounded-xl border text-[10px] uppercase tracking-[0.2em] py-2 transition-all duration-200 ${
                      entry.restored
                        ? "bg-cyan-300/15 border-cyan-300/40 text-cyan-300"
                        : "bg-white/5 border-white/10 text-white/30 hover:text-white/50"
                    }`}
                  >
                    ✦ Photo restaurée
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Barre d'action sticky ──────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="sticky bottom-0 bg-black/90 backdrop-blur-xl border-t border-white/10 -mx-5 md:-mx-10 px-6 py-4 flex items-center justify-between gap-4 mt-8">
          <p className="text-white/30 text-xs uppercase tracking-[0.2em] shrink-0">
            {entries.length} photo{entries.length > 1 ? "s" : ""}{" "}
            · {readyCount} prête{readyCount > 1 ? "s" : ""}
          </p>

          <div className="flex items-center gap-4 flex-wrap justify-end">
            {successCount > 0 && (
              <button
                onClick={() => setEntries(prev => prev.filter(e => e.status !== "success"))}
                className="text-emerald-400/50 hover:text-emerald-400 text-[10px] uppercase tracking-[0.2em] transition-colors"
              >
                Effacer les importées
              </button>
            )}
            <button
              onClick={() => {
                entries.forEach(e => URL.revokeObjectURL(e.previewUrl));
                setEntries([]);
              }}
              className="text-white/25 hover:text-red-400 text-[10px] uppercase tracking-[0.2em] transition-colors"
            >
              Tout effacer
            </button>
            <button
              onClick={handleSubmit}
              disabled={readyCount === 0 || submitting}
              className="px-6 py-2.5 rounded-full bg-cyan-300/10 border border-cyan-300/30 text-cyan-300 text-xs uppercase tracking-[0.25em] hover:bg-cyan-300/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Importation…"
                : `Importer ${readyCount} photo${readyCount > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
