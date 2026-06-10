"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Temoignage = {
  id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
};

type Props = { photoId: string };

const REPORT_REASONS = [
  { v: "spam",        l: "Spam ou publicité" },
  { v: "inapproprie", l: "Contenu inapproprié" },
  { v: "hors-sujet",  l: "Hors-sujet" },
  { v: "faux",        l: "Information fausse" },
  { v: "autre",       l: "Autre raison" },
];

export default function Temoignages({ photoId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [list, setList] = useState<Temoignage[]>([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signalement
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [reportToast, setReportToast] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single();
        setDisplayName(p?.display_name || "");
      }
    });
  }, []);

  useEffect(() => {
    supabase
      .from("temoignages")
      .select("id, author_id, author_name, content, created_at")
      .eq("photo_id", photoId)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .then(({ data }) => setList(data ?? []));
  }, [photoId]);

  async function handleSubmit() {
    if (!user || !displayName || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase
      .from("temoignages")
      .insert({
        photo_id: photoId,
        author_id: user.id,
        author_name: displayName,
        content: content.trim(),
      })
      .select("id, author_id, author_name, content, created_at")
      .single();
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setList((prev) => [data, ...prev]);
      setContent("");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer ce témoignage ?")) return;
    const { error } = await supabase.from("temoignages").delete().eq("id", id);
    if (!error) setList((prev) => prev.filter((t) => t.id !== id));
  }

  function openReport(id: string) {
    setReportingId(id);
    setReportReason("");
    setReportDetails("");
  }

  function closeReport() {
    setReportingId(null);
  }

  async function submitReport() {
    if (!user || !reportingId || !reportReason) return;
    setReportSubmitting(true);
    const { error } = await supabase
      .from("signalements_temoignages")
      .insert({
        temoignage_id: reportingId,
        reporter_id: user.id,
        raison: reportReason,
        details: reportDetails.trim() || null,
      });
    setReportSubmitting(false);
    if (error) {
      alert(`Erreur : ${error.message}`);
      return;
    }
    setReportedIds((prev) => new Set(prev).add(reportingId));
    closeReport();
    setReportToast("Merci, le signalement a été transmis aux modérateurs.");
    setTimeout(() => setReportToast(null), 4000);
  }

  return (
    <div className="border-t border-white/5 pt-6 mt-6">
      <p className="text-cyan-300 text-[10px] uppercase tracking-[0.35em] mb-5">
        Témoignages & souvenirs
      </p>

      {user ? (
        !displayName ? (
          <div className="mb-8 bg-amber-300/5 border border-amber-300/20 rounded-2xl p-5 text-center backdrop-blur-md">
            <p className="text-sm text-amber-200/80 mb-1">Profil incomplet</p>
            <p className="text-xs text-white/40">
              Votre nom et prénom ne sont pas encore renseignés. Contactez
              l&apos;administrateur du site.
            </p>
          </div>
        ) : (
          <div className="mb-8 bg-white/3 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Partagez un souvenir, une anecdote, une information sur cette photo…"
              maxLength={2000}
              rows={3}
              className="w-full bg-transparent text-sm text-white/85 placeholder-white/25 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                {displayName} · {content.length}/2000
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || content.trim().length < 5}
                className="px-5 py-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.25em] hover:bg-cyan-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? "Envoi…" : "Publier"}
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          </div>
        )
      ) : (
        <div className="mb-8 bg-white/3 border border-white/10 rounded-2xl p-5 text-center backdrop-blur-md">
          <p className="text-sm text-white/50 mb-3">
            Connectez-vous pour partager un témoignage
          </p>
          <Link
            href="/login"
            className="inline-block px-5 py-2 rounded-full border border-cyan-300/40 text-cyan-300 text-[10px] uppercase tracking-[0.25em] hover:bg-cyan-300/10 transition-all"
          >
            Se connecter
          </Link>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-white/30 italic">
          Aucun témoignage pour le moment. Soyez le premier à partager.
        </p>
      ) : (
        <ul className="space-y-4">
          {list.map((t) => {
            const date = new Date(t.created_at).toLocaleDateString("fr-BE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const isOwner = user?.id === t.author_id;
            return (
              <li
                key={t.id}
                className="bg-white/3 border border-white/10 rounded-2xl p-4 backdrop-blur-md"
              >
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <span className="text-cyan-300 text-[11px] uppercase tracking-[0.2em]">
                    {t.author_name}
                  </span>
                  <span className="text-white/25 text-[10px] uppercase tracking-[0.2em] shrink-0">
                    {date}
                  </span>
                </div>
                <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">
                  {t.content}
                </p>
                <div className="flex items-center mt-3">
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-[10px] uppercase tracking-[0.2em] text-white/30 hover:text-red-400 transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                  {!isOwner && user && !reportedIds.has(t.id) && (
                    <button
                      onClick={() => openReport(t.id)}
                      className="text-[10px] uppercase tracking-[0.2em] text-white/25 hover:text-amber-400 transition-colors"
                    >
                      Signaler
                    </button>
                  )}
                  {reportedIds.has(t.id) && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-amber-400/60">
                      Signalé
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal signalement */}
      {reportingId && (
        <div
          onClick={closeReport}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-950 border border-white/15 rounded-2xl p-6 shadow-2xl"
          >
            <p className="text-cyan-300 text-[10px] uppercase tracking-[0.35em] mb-5">
              Signaler ce témoignage
            </p>

            <div className="space-y-2 mb-5">
              {REPORT_REASONS.map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    reportReason === opt.v
                      ? "border-cyan-300/50 bg-cyan-300/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="raison"
                    value={opt.v}
                    checked={reportReason === opt.v}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="accent-cyan-300"
                  />
                  <span className="text-sm text-white/80">{opt.l}</span>
                </label>
              ))}
            </div>

            <label className="block text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2">
              Précisions (facultatif)
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Détails supplémentaires…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-300/40 resize-none"
            />

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeReport}
                className="px-4 py-2 rounded-full border border-white/15 text-white/60 text-[10px] uppercase tracking-[0.2em] hover:border-white/40 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason || reportSubmitting}
                className="px-5 py-2 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 text-[10px] uppercase tracking-[0.25em] hover:bg-amber-400/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {reportSubmitting ? "Envoi…" : "Signaler"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast confirmation */}
      {reportToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-emerald-400/15 border border-emerald-400/40 backdrop-blur-md">
          <p className="text-emerald-300 text-[11px] uppercase tracking-[0.2em]">
            {reportToast}
          </p>
        </div>
      )}
    </div>
  );
}
