"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const villages = [
  "Plombières",
  "Gemmenich",
  "Hombourg",
  "Moresnet",
  "Montzen",
  "Sippenaeken",
];

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
  restored: boolean;
};

type FormState = {
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
  restored: boolean;
  file: File | null;
};

const defaultForm: FormState = {
  title: "",
  village: villages[0],
  year: "",
  description: "",
  type: "",
  restored: false,
  file: null,
};

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200";
const labelClass =
  "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

export default function PhotosSection() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [addStatus, setAddStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [addError, setAddError] = useState("");

  const [editPhoto, setEditPhoto] = useState<Photo | null>(null);
  const [editStatus, setEditStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    const { data } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });
    setPhotos(data ?? []);
    setLoadingPhotos(false);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.file) {
      setAddError("Sélectionnez une image.");
      setAddStatus("error");
      return;
    }
    setAddStatus("loading");
    setAddError("");

    const ext = form.file.name.split(".").pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filename, form.file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      setAddError(uploadError.message);
      setAddStatus("error");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("photos")
      .getPublicUrl(filename);

    const { error: insertError } = await supabase.from("photos").insert({
      src: urlData.publicUrl,
      title: form.title,
      village: form.village,
      year: form.year,
      description: form.description,
      type: form.type,
      restored: form.restored,
      timeline: form.year,
    });
    if (insertError) {
      setAddError(insertError.message);
      setAddStatus("error");
      return;
    }

    setForm(defaultForm);
    setAddStatus("success");
    loadPhotos();
  }

  async function handleDelete(photo: Photo) {
    if (!window.confirm(`Supprimer "${photo.title}" ? Cette action est irréversible.`))
      return;
    setDeletingId(photo.id);
    const filename = photo.src.split("/").pop();
    if (filename) await supabase.storage.from("photos").remove([filename]);
    await supabase.from("photos").delete().eq("id", photo.id);
    setDeletingId(null);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function handleEditSave(e: { preventDefault(): void }) {
    if (!editPhoto) return;
    e.preventDefault();
    setEditStatus("loading");
    const { error } = await supabase
      .from("photos")
      .update({
        title: editPhoto.title,
        village: editPhoto.village,
        year: editPhoto.year,
        description: editPhoto.description,
        type: editPhoto.type,
        restored: editPhoto.restored,
        timeline: editPhoto.year,
      })
      .eq("id", editPhoto.id);
    if (error) {
      setEditStatus("error");
      return;
    }
    setEditStatus("success");
    setPhotos((prev) =>
      prev.map((p) => (p.id === editPhoto.id ? { ...p, ...editPhoto } : p))
    );
    setTimeout(() => {
      setEditPhoto(null);
      setEditStatus("idle");
    }, 700);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-light uppercase tracking-[0.15em]">
          Photos
        </h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setAddStatus("idle");
            setForm(defaultForm);
          }}
          className="px-5 py-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.25em] text-xs hover:bg-cyan-300/20 transition-all"
        >
          {showAddForm ? "Fermer" : "+ Ajouter"}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-10 bg-white/[0.02] border border-white/10 rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-6">
            Nouvelle photo
          </p>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Titre</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Ex : Mine du Bleyberg"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Village</label>
                <select
                  value={form.village}
                  onChange={(e) => setField("village", e.target.value)}
                  className={inputClass}
                >
                  {villages.map((v) => (
                    <option key={v} value={v} className="bg-zinc-900">
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Année</label>
                <input
                  type="text"
                  required
                  value={form.year}
                  onChange={(e) => setField("year", e.target.value)}
                  placeholder="Ex : 1902"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <input
                  type="text"
                  required
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value)}
                  placeholder="Ex : Photo ancienne…"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Description de la photo…"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="add-restored"
                type="checkbox"
                checked={form.restored}
                onChange={(e) => setField("restored", e.target.checked)}
                className="w-4 h-4 accent-cyan-300 cursor-pointer"
              />
              <label
                htmlFor="add-restored"
                className="text-xs uppercase tracking-[0.2em] text-white/60 cursor-pointer"
              >
                Photo restaurée
              </label>
            </div>
            <div>
              <label className={labelClass}>Image</label>
              <input
                type="file"
                required
                accept="image/*"
                onChange={(e) => setField("file", e.target.files?.[0] ?? null)}
                className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-white/20 file:bg-white/5 file:text-white/70 file:text-xs file:uppercase file:tracking-[0.2em] file:cursor-pointer hover:file:bg-white/10 file:transition-all"
              />
              {form.file && (
                <p className="mt-1.5 text-xs text-white/30">{form.file.name}</p>
              )}
            </div>
            {addStatus === "error" && (
              <p className="text-red-400 text-xs uppercase tracking-[0.2em]">
                {addError}
              </p>
            )}
            {addStatus === "success" && (
              <p className="text-cyan-300 text-xs uppercase tracking-[0.2em]">
                Photo ajoutée avec succès.
              </p>
            )}
            <button
              type="submit"
              disabled={addStatus === "loading"}
              className="px-8 py-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.25em] text-xs hover:bg-cyan-300/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {addStatus === "loading" ? "Envoi en cours…" : "Ajouter la photo"}
            </button>
          </form>
        </div>
      )}

      {/* Photos list */}
      {loadingPhotos ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Chargement…
        </p>
      ) : photos.length === 0 ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Aucune photo.
        </p>
      ) : (
        <div className="space-y-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="flex items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-3 hover:border-white/20 transition-all"
            >
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5">
                <Image
                  src={photo.src}
                  alt={photo.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{photo.title}</p>
                <p className="text-xs text-white/40 uppercase tracking-[0.15em] mt-0.5">
                  {photo.village} · {photo.year}
                </p>
              </div>
              <span className="hidden lg:block text-xs text-white/25 uppercase tracking-[0.15em] shrink-0">
                {photo.type}
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditPhoto(photo);
                    setEditStatus("idle");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs uppercase tracking-[0.15em] hover:border-cyan-300/40 hover:text-cyan-300 transition-all"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(photo)}
                  disabled={deletingId === photo.id}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs uppercase tracking-[0.15em] hover:border-red-400/40 hover:text-red-400 transition-all disabled:opacity-30"
                >
                  {deletingId === photo.id ? "…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Modifier la photo
              </p>
              <button
                onClick={() => setEditPhoto(null)}
                className="text-white/30 hover:text-white text-2xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Titre</label>
                  <input
                    type="text"
                    required
                    value={editPhoto.title}
                    onChange={(e) =>
                      setEditPhoto({ ...editPhoto, title: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Village</label>
                  <select
                    value={editPhoto.village}
                    onChange={(e) =>
                      setEditPhoto({ ...editPhoto, village: e.target.value })
                    }
                    className={inputClass}
                  >
                    {villages.map((v) => (
                      <option key={v} value={v} className="bg-zinc-900">
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Année</label>
                  <input
                    type="text"
                    required
                    value={editPhoto.year}
                    onChange={(e) =>
                      setEditPhoto({ ...editPhoto, year: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <input
                    type="text"
                    required
                    value={editPhoto.type}
                    onChange={(e) =>
                      setEditPhoto({ ...editPhoto, type: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  value={editPhoto.description}
                  onChange={(e) =>
                    setEditPhoto({
                      ...editPhoto,
                      description: e.target.value,
                    })
                  }
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="edit-restored"
                  type="checkbox"
                  checked={editPhoto.restored}
                  onChange={(e) =>
                    setEditPhoto({ ...editPhoto, restored: e.target.checked })
                  }
                  className="w-4 h-4 accent-cyan-300 cursor-pointer"
                />
                <label
                  htmlFor="edit-restored"
                  className="text-xs uppercase tracking-[0.2em] text-white/60 cursor-pointer"
                >
                  Photo restaurée
                </label>
              </div>
              {editStatus === "error" && (
                <p className="text-red-400 text-xs uppercase tracking-[0.2em]">
                  Erreur lors de la mise à jour.
                </p>
              )}
              {editStatus === "success" && (
                <p className="text-cyan-300 text-xs uppercase tracking-[0.2em]">
                  Modifications enregistrées.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={editStatus === "loading"}
                  className="px-8 py-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.25em] text-xs hover:bg-cyan-300/20 transition-all disabled:opacity-40"
                >
                  {editStatus === "loading" ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditPhoto(null)}
                  className="px-6 py-3 rounded-full border border-white/10 text-white/40 uppercase tracking-[0.25em] text-xs hover:border-white/20 hover:text-white/60 transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
