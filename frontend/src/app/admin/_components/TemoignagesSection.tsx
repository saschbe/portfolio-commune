"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/imageUrl";
import { logActivite } from "@/lib/logActivite";

type Signalement = {
  id: string;
  raison: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
  reporter_id: string | null;
  reporter?: { display_name: string | null } | null;
};

type Temoignage = {
  id: string;
  photo_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  status: "visible" | "hidden" | "deleted";
  created_at: string;
  photos: { id: string; title: string; village: string; src: string } | null;
  signalements_count: number;
  signalements_pending: number;
};

const RAISON_LABELS: Record<string, string> = {
  spam:        "Spam",
  inapproprie: "Inapproprié",
  "hors-sujet": "Hors-sujet",
  faux:        "Information fausse",
  autre:       "Autre",
};

const STATUS_STYLES: Record<string, string> = {
  visible: "border-emerald-400/30 text-emerald-300 bg-emerald-400/5",
  hidden:  "border-amber-400/30 text-amber-300 bg-amber-400/5",
  deleted: "border-red-400/30 text-red-300 bg-red-400/5",
};

const STATUS_LABELS: Record<string, string> = {
  visible: "Visible",
  hidden:  "Masqué",
  deleted: "Supprimé",
};

type FilterKey = "all" | "visible" | "hidden" | "deleted" | "reported";

export default function TemoignagesSection() {
  const [list, setList] = useState<Temoignage[]>([]);
  const [filter, setFilter] = useState<FilterKey>("reported");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [signalements, setSignalements] = useState<Record<string, Signalement[]>>({});
  const [loading, setLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserId.current = data.user?.id ?? null;
    });
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);

    const { data: temoignages } = await supabase
      .from("temoignages")
      .select("id, photo_id, author_id, author_name, content, status, created_at, photos:photo_id (id, title, village, src)")
      .order("created_at", { ascending: false });

    const { data: sigCounts } = await supabase
      .from("signalements_temoignages")
      .select("temoignage_id, status");

    const countByTemoignage = new Map<string, { total: number; pending: number }>();
    (sigCounts ?? []).forEach((s) => {
      const c = countByTemoignage.get(s.temoignage_id) ?? { total: 0, pending: 0 };
      c.total++;
      if (s.status === "pending") c.pending++;
      countByTemoignage.set(s.temoignage_id, c);
    });

    const merged: Temoignage[] = ((temoignages ?? []) as unknown as Temoignage[]).map((t) => ({
      ...t,
      signalements_count:   countByTemoignage.get(t.id)?.total   ?? 0,
      signalements_pending: countByTemoignage.get(t.id)?.pending ?? 0,
    }));

    merged.sort((a, b) => {
      if (a.signalements_pending !== b.signalements_pending)
        return b.signalements_pending - a.signalements_pending;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setList(merged);
    setLoading(false);
  }

  async function loadSignalements(temoignageId: string) {
    if (signalements[temoignageId]) return;
    const { data } = await supabase
      .from("signalements_temoignages")
      .select("id, raison, details, status, created_at, reporter_id, reporter:reporter_id (display_name)")
      .eq("temoignage_id", temoignageId)
      .order("created_at", { ascending: false });
    setSignalements((prev) => ({ ...prev, [temoignageId]: (data ?? []) as unknown as Signalement[] }));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadSignalements(id);
  }

  async function setStatus(t: Temoignage, next: "visible" | "hidden") {
    const { error } = await supabase.from("temoignages").update({ status: next }).eq("id", t.id);
    if (error) { alert(error.message); return; }
    await logActivite({
      type: next === "hidden" ? "temoignage_masque" : "temoignage_restaure",
      description: `Témoignage de "${t.author_name}" ${next === "hidden" ? "masqué" : "restauré"}`,
      photo_id: t.photo_id,
      actor_id: currentUserId.current,
      meta: { temoignage_id: t.id },
    });
    setList((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
  }

  async function hardDelete(t: Temoignage) {
    if (!window.confirm(`Supprimer définitivement le témoignage de "${t.author_name}" ? Action irréversible.`)) return;
    const { error } = await supabase.from("temoignages").delete().eq("id", t.id);
    if (error) { alert(error.message); return; }
    await logActivite({
      type: "temoignage_supprime",
      description: `Témoignage de "${t.author_name}" supprimé définitivement`,
      photo_id: t.photo_id,
      actor_id: currentUserId.current,
      meta: { temoignage_id: t.id, content: t.content },
    });
    setList((prev) => prev.filter((x) => x.id !== t.id));
  }

  async function updateSigStatus(sigId: string, temoignageId: string, next: "reviewed" | "dismissed") {
    const { error } = await supabase.from("signalements_temoignages").update({ status: next }).eq("id", sigId);
    if (error) { alert(error.message); return; }
    setSignalements((prev) => ({
      ...prev,
      [temoignageId]: prev[temoignageId].map((s) => (s.id === sigId ? { ...s, status: next } : s)),
    }));
    setList((prev) => prev.map((t) => {
      if (t.id !== temoignageId) return t;
      const newPending = (signalements[temoignageId] ?? []).filter((s) => s.id !== sigId && s.status === "pending").length;
      return { ...t, signalements_pending: newPending };
    }));
  }

  const filtered = useMemo(() => {
    if (filter === "all")      return list;
    if (filter === "reported") return list.filter((t) => t.signalements_pending > 0);
    return list.filter((t) => t.status === filter);
  }, [list, filter]);

  const filters: Array<{ k: FilterKey; label: string; count: number }> = [
    { k: "reported", label: "Signalés",   count: list.filter((t) => t.signalements_pending > 0).length },
    { k: "visible",  label: "Visibles",   count: list.filter((t) => t.status === "visible").length },
    { k: "hidden",   label: "Masqués",    count: list.filter((t) => t.status === "hidden").length },
    { k: "deleted",  label: "Supprimés",  count: list.filter((t) => t.status === "deleted").length },
    { k: "all",      label: "Tous",       count: list.length },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`px-4 py-2 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-all ${
              filter === f.k
                ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-300"
                : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
            }`}
          >
            {f.label} <span className="ml-2 text-white/30">{f.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-white/30">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/30 italic">Aucun témoignage dans cette catégorie.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((t) => {
            const expanded = expandedId === t.id;
            const sigs = signalements[t.id] ?? [];
            return (
              <li key={t.id} className="bg-white/3 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                <div className="flex flex-wrap items-start gap-3 mb-3">
                  {t.photos && (
                    <Link href={`/photo/${t.photos.id}`} target="_blank" className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-white/5">
                      <Image
                        src={imageUrl(t.photos.src, "thumb") ?? ""}
                        alt={t.photos.title}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    </Link>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-3 mb-1">
                      <span className="text-cyan-300 text-[11px] uppercase tracking-[0.2em]">{t.author_name}</span>
                      {t.photos && (
                        <span className="text-white/40 text-[10px] uppercase tracking-[0.2em]">
                          sur « {t.photos.title} » — {t.photos.village}
                        </span>
                      )}
                      <span className={`ml-auto shrink-0 px-2.5 py-0.5 rounded-full border text-[9px] uppercase tracking-[0.15em] ${STATUS_STYLES[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{t.content}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mt-2">
                      {new Date(t.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
                  {t.signalements_count > 0 && (
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className={`px-3 py-1.5 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-all ${
                        t.signalements_pending > 0
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                          : "border-white/15 text-white/50 hover:border-white/30"
                      }`}
                    >
                      {t.signalements_count} signalement{t.signalements_count > 1 ? "s" : ""}
                      {t.signalements_pending > 0 && ` (${t.signalements_pending} en attente)`}
                      <span className="ml-2">{expanded ? "▴" : "▾"}</span>
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    {t.status === "visible" ? (
                      <button
                        onClick={() => setStatus(t, "hidden")}
                        className="px-3 py-1.5 rounded-full border border-amber-400/30 text-amber-300 text-[10px] uppercase tracking-[0.2em] hover:bg-amber-400/10 transition-all"
                      >
                        Masquer
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(t, "visible")}
                        className="px-3 py-1.5 rounded-full border border-emerald-400/30 text-emerald-300 text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400/10 transition-all"
                      >
                        Restaurer
                      </button>
                    )}
                    <button
                      onClick={() => hardDelete(t)}
                      className="px-3 py-1.5 rounded-full border border-red-400/30 text-red-300 text-[10px] uppercase tracking-[0.2em] hover:bg-red-400/10 transition-all"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {expanded && sigs.length > 0 && (
                  <ul className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    {sigs.map((s) => (
                      <li key={s.id} className="bg-white/5 rounded-xl p-3">
                        <div className="flex flex-wrap items-baseline gap-3 mb-1">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300">
                            {RAISON_LABELS[s.raison] ?? s.raison}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                            par {s.reporter?.display_name ?? "Anonyme"} — {new Date(s.created_at).toLocaleDateString("fr-BE")}
                          </span>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.15em] border ${
                            s.status === "pending"
                              ? "border-amber-400/30 text-amber-300"
                              : s.status === "reviewed"
                                ? "border-emerald-400/30 text-emerald-300"
                                : "border-white/15 text-white/40"
                          }`}>
                            {s.status === "pending" ? "En attente" : s.status === "reviewed" ? "Traité" : "Rejeté"}
                          </span>
                        </div>
                        {s.details && <p className="text-xs text-white/50 mt-2 mb-2">{s.details}</p>}
                        {s.status === "pending" && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updateSigStatus(s.id, t.id, "reviewed")}
                              className="px-3 py-1 rounded-full border border-emerald-400/30 text-emerald-300 text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400/10 transition-all"
                            >
                              Marquer traité
                            </button>
                            <button
                              onClick={() => updateSigStatus(s.id, t.id, "dismissed")}
                              className="px-3 py-1 rounded-full border border-white/15 text-white/50 text-[10px] uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
                            >
                              Rejeter
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
