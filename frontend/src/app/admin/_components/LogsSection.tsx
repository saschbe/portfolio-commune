"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type Log = {
  id: string;
  type: string;
  description: string;
  photo_id: string | null;
  actor_id: string | null;
  meta: Record<string, unknown> | null;
  details: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
  created_at: string;
  profiles: { email: string; role: string } | null;
};

// ── Config par type ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  photo_importee:     { label: "Importée",    badge: "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",        dot: "bg-cyan-300" },
  photo_soumise:      { label: "Soumise",     badge: "text-blue-300 bg-blue-300/10 border-blue-300/20",        dot: "bg-blue-300" },
  photo_approuvee:    { label: "Approuvée",   badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", dot: "bg-emerald-400" },
  photo_rejetee:      { label: "Rejetée",     badge: "text-red-400 bg-red-400/10 border-red-400/20",           dot: "bg-red-400" },
  statut_modifie:     { label: "Statut",      badge: "text-amber-300 bg-amber-300/10 border-amber-300/20",     dot: "bg-amber-300" },
  photo_modifiee:     { label: "Modifiée",    badge: "text-purple-300 bg-purple-300/10 border-purple-300/20",  dot: "bg-purple-300" },
  photo_supprimee:    { label: "Supprimée",   badge: "text-red-500 bg-red-500/10 border-red-500/20",           dot: "bg-red-500" },
  signalement_traite: { label: "Signalement", badge: "text-orange-300 bg-orange-300/10 border-orange-300/20", dot: "bg-orange-300" },
};
const DEFAULT_CONFIG = { label: "Autre", badge: "text-white/30 bg-white/5 border-white/10", dot: "bg-white/20" };

const FILTER_TYPES = [
  { value: "all",                label: "Tous" },
  { value: "photo_importee",     label: "Importée" },
  { value: "photo_soumise",      label: "Soumise" },
  { value: "photo_approuvee",    label: "Approuvée" },
  { value: "photo_rejetee",      label: "Rejetée" },
  { value: "photo_modifiee",     label: "Modifiée" },
  { value: "photo_supprimee",    label: "Supprimée" },
  { value: "signalement_traite", label: "Signalement" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-BE", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getPeriodFrom(period: string): string | null {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === "week") {
    const d = new Date(now); d.setDate(now.getDate() - 7); return d.toISOString();
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null;
}

// ── Diff before/after ─────────────────────────────────────────────────────────

function DiffView({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const changed = Object.keys(after).filter(
    (k) => String(after[k] ?? "") !== String(before[k] ?? "")
  );
  if (changed.length === 0) return null;
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 mt-3 space-y-1.5">
      {changed.map((k) => (
        <div key={k} className="flex items-center gap-2 flex-wrap">
          <span className="text-white/30 text-[10px] uppercase tracking-[0.2em] w-20 shrink-0">{k}</span>
          <span className="text-white/40 text-xs">{String(before[k] ?? "—")}</span>
          <span className="text-white/20 text-xs">→</span>
          <span className="text-white/70 text-xs">{String(after[k] ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LogsSection() {
  const [logs, setLogs]               = useState<Log[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterType, setFilterType]   = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");

  async function loadLogs() {
    setLoading(true);

    let query = supabase
      .from("activites")
      .select("id, type, description, photo_id, actor_id, meta, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .not("type", "in", '("daily_digest","daily-digest","journal_quotidien","new_member")')
      .not("description", "ilike", "%journal quotidien%")
      .not("description", "ilike", "%digest%");

    if (filterType !== "all") query = query.eq("type", filterType);

    if (filterPeriod !== "all") {
      const now = new Date();
      let from: Date;
      if (filterPeriod === "today") {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filterPeriod === "week") {
        from = new Date(now); from.setDate(now.getDate() - 7);
      } else {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      query = query.gte("created_at", from.toISOString());
    }

    const { data, error } = await query;
    if (error) { console.error("[logs] load:", error.message); setLoading(false); return; }

    const rawLogs = (data ?? []) as Omit<Log, "profiles">[];

    // Fetch profiles separately to avoid the auth.users → profiles join issue
    const actorIds = [...new Set(rawLogs.map(l => l.actor_id).filter(Boolean))] as string[];
    const profileMap: Record<string, { email: string; role: string }> = {};

    if (actorIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, email, role")
        .in("id", actorIds);
      (profileData ?? []).forEach(p => {
        profileMap[p.id] = { email: p.email, role: p.role };
      });
    }

    setLogs(rawLogs.map(l => ({
      ...l,
      profiles: l.actor_id ? (profileMap[l.actor_id] ?? null) : null,
    })));
    setLoading(false);
  }

  function handleExportCSV() {
    if (logs.length === 0) return;

    const headers = ["Date", "Type", "Description", "Photo ID", "Acteur", "Rôle", "Détails"];

    const rows = logs.map((log) => {
      const before = log.details?.before
        ? Object.entries(log.details.before).map(([k, v]) => `${k}: ${v}`).join(" | ")
        : "";
      const after = log.details?.after
        ? Object.entries(log.details.after).map(([k, v]) => `${k}: ${v}`).join(" | ")
        : "";
      const details = before && after ? `AVANT: ${before} → APRÈS: ${after}` : "";

      return [
        new Date(log.created_at).toLocaleString("fr-BE"),
        log.type,
        log.description,
        log.photo_id ?? "",
        log.profiles?.email ?? log.actor_id ?? "",
        log.profiles?.role ?? "",
        details,
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`);
    });

    const csvContent = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `logs-plombieres-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  useEffect(() => { loadLogs(); }, [filterType, filterPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl">

      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-light uppercase tracking-[0.15em] mb-1">
            Historique des activités
          </h2>
          {!loading && (
            <p className="text-white/30 text-[10px] uppercase tracking-[0.25em]">
              {logs.length} événement{logs.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Filtre période */}
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-xs uppercase tracking-[0.15em] focus:outline-none focus:border-cyan-300/40 transition-all [&>option]:bg-zinc-900 cursor-pointer"
          >
            <option value="all">Toutes les périodes</option>
            <option value="today">Aujourd&apos;hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois-ci</option>
          </select>
          {/* Exporter CSV */}
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:border-white/20 text-[10px] uppercase tracking-[0.25em] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↓ Exporter CSV
          </button>
          {/* Actualiser */}
          <button
            onClick={loadLogs}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/40 text-xs uppercase tracking-[0.2em] hover:border-white/20 hover:text-white/60 transition-all"
          >
            ↺ Actualiser
          </button>
        </div>
      </div>

      {/* Filtres type */}
      <div className="flex flex-wrap gap-2 mb-8">
        {FILTER_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterType(value)}
            className={`px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-[0.2em] transition-all duration-200 ${
              filterType === value
                ? "bg-cyan-300/10 border-cyan-300/40 text-cyan-300"
                : "bg-white/5 border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <p className="text-white/30 uppercase tracking-[0.35em] text-xs text-center py-16">
          Chargement…
        </p>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 border border-white/5 rounded-3xl">
          <p className="text-white/20 uppercase tracking-[0.35em] text-xs mb-2">Aucun événement</p>
          <p className="text-white/10 text-[10px] uppercase tracking-[0.2em]">
            Les actions sur les photos apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const cfg = TYPE_CONFIG[log.type] ?? DEFAULT_CONFIG;
            const hasDiff =
              log.details?.before != null && log.details?.after != null;

            return (
              <div
                key={log.id}
                className="flex gap-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl px-5 py-4 hover:border-white/15 transition-all"
              >
                {/* Dot timeline */}
                <div className={`w-2 h-2 rounded-full shrink-0 mt-2 ${cfg.dot}`} />

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  {/* Badge type + date */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.2em] ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-white/25 text-[10px] uppercase tracking-[0.15em]">
                      {fmtDate(log.created_at)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-white/70 text-sm leading-relaxed mb-2">
                    {log.description}
                  </p>

                  {/* Diff avant/après */}
                  {hasDiff && (
                    <DiffView
                      before={log.details!.before!}
                      after={log.details!.after!}
                    />
                  )}

                  {/* Footer : acteur + lien photo */}
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    {log.actor_id && (
                      <span className="text-white/25 text-[10px] uppercase tracking-[0.15em]">
                        Par : {log.actor_id.slice(0, 8)}…
                      </span>
                    )}
                    {log.photo_id && (
                      <Link
                        href={`/photo/${log.photo_id}`}
                        target="_blank"
                        className="text-cyan-300/50 hover:text-cyan-300 text-[10px] uppercase tracking-[0.2em] transition-colors"
                      >
                        Voir la photo →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
