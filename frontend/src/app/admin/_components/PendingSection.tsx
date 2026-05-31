"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { logActivite } from "@/lib/logActivite";
import { imageUrl } from "@/lib/imageUrl";

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
  restored: boolean;
  status: string;
};

export default function PendingSection({
  onCountChange,
}: {
  onCountChange: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    loadPending();
    supabase.auth.getUser().then(({ data }) => {
      currentUserId.current = data.user?.id ?? null;
    });
  }, []);

  async function loadPending() {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) console.error("[pending] loadPending:", error);
    const list = data ?? [];
    setPhotos(list);
    setLoading(false);
  }

  async function handleApprove(photo: Photo) {
    setProcessingId(photo.id);
    setActionError(null);
    console.log("[pending] approve — id:", photo.id);
    try {
      const { data, error } = await supabase
        .from("photos")
        .update({ status: "approved" })
        .eq("id", photo.id)
        .select();
      console.log("[pending] approve — response:", { data, error });
      if (error) {
        setActionError(`Erreur lors de l'approbation : ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        const msg = "Aucune ligne mise à jour — vérifiez les politiques RLS de la table photos.";
        console.warn("[pending] approve —", msg);
        setActionError(msg);
        return;
      }
      await logActivite({
        type:        "photo_approuvee",
        description: `Photo approuvée : "${photo.title}" (${photo.village})`,
        photo_id:    photo.id,
        actor_id:    currentUserId.current,
        meta: { title: photo.title, village: photo.village },
      });
      await loadPending();
      onCountChange();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(photo: Photo) {
    if (!window.confirm(`Rejeter et supprimer définitivement "${photo.title}" ?`))
      return;
    setProcessingId(photo.id);
    setActionError(null);
    console.log("[pending] reject — id:", photo.id);
    try {
      const filename = photo.src.split("/").pop();
      if (filename) {
        const { error: storageError } = await supabase.storage
          .from("photos")
          .remove([filename]);
        if (storageError)
          console.warn("[pending] reject storage:", storageError);
      }
      const { data, error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id)
        .select();
      console.log("[pending] reject — response:", { data, error });
      if (error) {
        setActionError(`Erreur lors du rejet : ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        const msg = "Aucune ligne supprimée — vérifiez les politiques RLS de la table photos.";
        console.warn("[pending] reject —", msg);
        setActionError(msg);
        return;
      }
      await logActivite({
        type:        "photo_rejetee",
        description: `Photo rejetée et supprimée : "${photo.title}" (${photo.village})`,
        photo_id:    photo.id,
        actor_id:    currentUserId.current,
        meta: { title: photo.title, village: photo.village, src: photo.src },
      });
      await loadPending();
      onCountChange();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-light uppercase tracking-[0.15em] mb-2">
        En attente d&apos;approbation
      </h2>
      <p className="text-white/30 text-xs uppercase tracking-[0.25em] mb-8">
        Photos soumises en attente de validation
      </p>

      {actionError && (
        <p className="mb-6 text-red-400 text-xs uppercase tracking-[0.2em]">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Chargement…
        </p>
      ) : photos.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center border border-white/5 rounded-2xl">
          <p className="text-white/20 uppercase tracking-[0.3em] text-xs">
            Aucune photo en attente
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
            >
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <div className="relative w-28 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5">
                  <Image
                    src={imageUrl(photo.src, "thumb")}
                    alt={photo.title}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{photo.title}</p>
                      <p className="text-xs text-white/40 uppercase tracking-[0.15em] mt-1">
                        {photo.village} · {photo.year} · {photo.type}
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-300/10 border border-amber-300/30 text-amber-300 text-[10px] uppercase tracking-[0.2em]">
                      En attente
                    </span>
                  </div>
                  {photo.description && (
                    <p className="text-sm text-white/35 mt-2 line-clamp-2">
                      {photo.description}
                    </p>
                  )}
                  {photo.restored && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-cyan-300/10 border border-cyan-300/20 text-cyan-300 text-[10px] uppercase tracking-[0.2em] rounded-full">
                      Restaurée
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => handleApprove(photo)}
                  disabled={processingId === photo.id}
                  className="px-5 py-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-400 uppercase tracking-[0.2em] text-xs hover:bg-emerald-400/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {processingId === photo.id ? "…" : "Approuver"}
                </button>
                <button
                  onClick={() => handleReject(photo)}
                  disabled={processingId === photo.id}
                  className="px-5 py-2 rounded-full border border-red-400/40 bg-red-400/10 text-red-400 uppercase tracking-[0.2em] text-xs hover:bg-red-400/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
