"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Signalement = {
  id: string;
  photo_id: string;
  raison: string;
  details: string | null;
  email: string | null;
  status: string;
  created_at: string;
  photos: {
    title: string;
    src: string;
    village: string;
    year: string;
    description: string;
    type: string;
  } | null;
};

type EditForm = {
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending:     "En attente",
  in_progress: "En cours",
  resolved:    "Résolu",
};

const STATUS_STYLES: Record<string, string> = {
  pending:     "border-amber-300/30 bg-amber-300/10 text-amber-300",
  in_progress: "border-cyan-300/30 bg-cyan-300/10 text-cyan-300",
  resolved:    "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-BE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SignalementsSection({ onCountChange }: { onCountChange: () => void }) {
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [loading, setLoading]           = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Menu actions
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Mode édition inline
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm, setEditForm]     = useState<EditForm>({ title: "", village: "", year: "", description: "", type: "" });

  // Mode motif "En attente"
  const [motifId, setMotifId]     = useState<string | null>(null);
  const [motifText, setMotifText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signalements")
      .select("*, photos(title, src, village, year, description, type)")
      .order("created_at", { ascending: false });
    console.log("[signalements] load →", { data, error });
    setSignalements((data ?? []) as Signalement[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function deletePhoto(s: Signalement) {
    if (!confirm(`Supprimer définitivement "${s.photos?.title ?? s.photo_id}" ?`)) return;
    setProcessingId(s.id);
    setActionMenuId(null);
    await supabase.from("photos").delete().eq("id", s.photo_id);
    await supabase.from("signalements").update({ status: "resolved" }).eq("id", s.id);
    setSignalements((prev) => prev.filter((x) => x.id !== s.id));
    setProcessingId(null);
    onCountChange();
  }

  function startEdit(s: Signalement) {
    setEditingId(s.id);
    setEditForm({
      title:       s.photos?.title ?? "",
      village:     s.photos?.village ?? "",
      year:        s.photos?.year ?? "",
      description: s.photos?.description ?? "",
      type:        s.photos?.type ?? "",
    });
    setActionMenuId(null);
  }

  async function saveEdit(s: Signalement) {
    setProcessingId(s.id);
    await supabase.from("photos").update(editForm).eq("id", s.photo_id);
    setSignalements((prev) => prev.map((x) =>
      x.id === s.id
        ? { ...x, photos: x.photos ? { ...x.photos, ...editForm } : x.photos }
        : x
    ));
    setEditingId(null);
    setProcessingId(null);
  }

  function startMotif(s: Signalement) {
    setMotifId(s.id);
    setMotifText("");
    setActionMenuId(null);
  }

  async function saveMotif(s: Signalement) {
    setProcessingId(s.id);
    await supabase.from("signalements")
      .update({ status: "in_progress", details: motifText.trim() || s.details })
      .eq("id", s.id);
    setSignalements((prev) => prev.map((x) =>
      x.id === s.id
        ? { ...x, status: "in_progress", details: motifText.trim() || x.details }
        : x
    ));
    setMotifId(null);
    setMotifText("");
    setProcessingId(null);
    onCountChange();
  }

  async function approvePhoto(s: Signalement) {
    setProcessingId(s.id);
    setActionMenuId(null);
    await supabase.from("photos").update({ status: "approved" }).eq("id", s.photo_id);
    await supabase.from("signalements").update({ status: "resolved" }).eq("id", s.id);
    setSignalements((prev) => prev.map((x) =>
      x.id === s.id ? { ...x, status: "resolved" } : x
    ));
    setProcessingId(null);
    onCountChange();
  }

  // ── Dérivés ─────────────────────────────────────────────────────────────────

  const filtered = filterStatus === "all"
    ? signalements
    : signalements.filter((s) => s.status === filterStatus);

  const counts = {
    all:         signalements.length,
    pending:     signalements.filter((s) => s.status === "pending").length,
    in_progress: signalements.filter((s) => s.status === "in_progress").length,
    resolved:    signalements.filter((s) => s.status === "resolved").length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-10 max-w-5xl">

      {/* En-tête */}
      <div className="mb-8">
        <p className="text-cyan-300 uppercase tracking-[0.4em] text-xs mb-1">Administration</p>
        <h2 className="text-2xl font-light uppercase tracking-[0.15em]">Signalements</h2>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-8">
        {([
          ["all", "Tous"],
          ["pending", "En attente"],
          ["in_progress", "En cours"],
          ["resolved", "Résolus"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.2em] transition-all duration-200 ${
              filterStatus === key
                ? "bg-cyan-300/10 border-cyan-300/30 text-cyan-300"
                : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
            }`}
          >
            {label}
            <span className="ml-1.5 text-white/30">{counts[key as keyof typeof counts]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/30 uppercase tracking-[0.35em] text-xs text-center py-16">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-white/5 rounded-3xl">
          <p className="text-white/20 uppercase tracking-[0.35em] text-xs">Aucun signalement</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white/2 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all duration-300"
            >
              <div className="flex gap-4">
                {/* Miniature */}
                {s.photos?.src && (
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-white/10">
                    <Image src={s.photos.src} alt={s.photos.title ?? ""} width={64} height={64}
                      className="object-cover w-full h-full" />
                  </div>
                )}

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <span className="text-sm font-light text-white truncate">
                      {s.photos?.title ?? s.photo_id}
                    </span>
                    {s.photos?.village && (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-white/30">{s.photos.village}</span>
                    )}
                    <span className={`ml-auto shrink-0 px-2.5 py-0.5 rounded-full border text-[9px] uppercase tracking-[0.15em] ${STATUS_STYLES[s.status] ?? STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </div>

                  <p className="text-xs uppercase tracking-[0.15em] text-red-400/70 mb-1">{s.raison}</p>

                  {s.details && (
                    <p className="text-sm text-white/50 mb-2 leading-relaxed">{s.details}</p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/25 uppercase tracking-widest">
                    <span>{fmtDate(s.created_at)}</span>
                    {s.email && <span>✉ {s.email}</span>}
                  </div>
                </div>
              </div>

              {/* Formulaire d'édition inline */}
              {editingId === s.id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 mb-3">Modifier la photo</p>
                  {(["title", "village", "year", "type"] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{field}</label>
                      <input
                        type="text"
                        value={editForm[field]}
                        onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/50 transition-all"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/50 transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-full border border-white/10 text-white/40 text-[10px] uppercase tracking-[0.2em] hover:border-white/20 hover:text-white/60 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => saveEdit(s)}
                      disabled={processingId === s.id}
                      className="px-4 py-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.2em] hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all disabled:opacity-40"
                    >
                      {processingId === s.id ? "Sauvegarde…" : "Sauvegarder"}
                    </button>
                  </div>
                </div>
              )}

              {/* Saisie motif "En attente" */}
              {motifId === s.id && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300 mb-3">Motif de mise en attente</p>
                  <textarea
                    value={motifText}
                    onChange={(e) => setMotifText(e.target.value)}
                    rows={2}
                    placeholder="Expliquer pourquoi ce signalement est en attente…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-300/50 transition-all resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setMotifId(null)}
                      className="px-4 py-2 rounded-full border border-white/10 text-white/40 text-[10px] uppercase tracking-[0.2em] hover:border-white/20 hover:text-white/60 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => saveMotif(s)}
                      disabled={processingId === s.id}
                      className="px-4 py-2 rounded-full border border-amber-300/40 bg-amber-300/10 text-amber-300 text-[10px] uppercase tracking-[0.2em] hover:bg-amber-300/20 hover:border-amber-300/70 transition-all disabled:opacity-40"
                    >
                      {processingId === s.id ? "…" : "Confirmer"}
                    </button>
                  </div>
                </div>
              )}

              {/* Menu d'actions */}
              {s.status !== "resolved" && editingId !== s.id && motifId !== s.id && (
                <div className="relative mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={() => setActionMenuId(actionMenuId === s.id ? null : s.id)}
                    disabled={processingId === s.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white/50 text-[10px] uppercase tracking-[0.2em] hover:border-white/20 hover:text-white/70 transition-all disabled:opacity-40"
                  >
                    {processingId === s.id ? "…" : "Actions"}
                    <span className="text-white/30">{actionMenuId === s.id ? "▲" : "▼"}</span>
                  </button>

                  {actionMenuId === s.id && (
                    <>
                      {/* Backdrop invisible pour fermer */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActionMenuId(null)}
                      />
                      <div className="absolute left-0 top-full mt-2 z-20 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)] min-w-55">
                        <button
                          onClick={() => startEdit(s)}
                          className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.15em] text-white/60 hover:text-cyan-300 hover:bg-white/5 transition-all border-b border-white/5"
                        >
                          ✏ Modifier la photo
                        </button>
                        <button
                          onClick={() => startMotif(s)}
                          className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.15em] text-white/60 hover:text-amber-300 hover:bg-white/5 transition-all border-b border-white/5"
                        >
                          ⏸ En attente
                        </button>
                        <button
                          onClick={() => approvePhoto(s)}
                          className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.15em] text-white/60 hover:text-emerald-400 hover:bg-white/5 transition-all border-b border-white/5"
                        >
                          ✓ Tout est ok
                        </button>
                        <button
                          onClick={() => deletePhoto(s)}
                          className="w-full text-left px-4 py-3 text-xs uppercase tracking-[0.15em] text-white/60 hover:text-red-400 hover:bg-white/5 transition-all"
                        >
                          ✕ Supprimer la photo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}