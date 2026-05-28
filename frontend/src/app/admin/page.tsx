"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const villages = [
  "Plombières",
  "Gemmenich",
  "Hombourg",
  "Moresnet",
  "Montzen",
  "Sippenaeken",
];

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

export default function AdminPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.file) {
      setErrorMsg("Veuillez sélectionner une image.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const ext = form.file.name.split(".").pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filename, form.file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setErrorMsg(uploadError.message);
      setStatus("error");
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
      setErrorMsg(insertError.message);
      setStatus("error");
      return;
    }

    setForm(defaultForm);
    setStatus("success");
  }

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200";

  const labelClass =
    "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

  return (
    <div className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-4">
          Administration
        </p>
        <h1 className="text-3xl md:text-4xl font-light uppercase tracking-[0.15em] mb-12">
          Ajouter une photo
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Titre */}
          <div>
            <label className={labelClass}>Titre</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex : Mine du Bleyberg"
              className={inputClass}
            />
          </div>

          {/* Village */}
          <div>
            <label className={labelClass}>Village</label>
            <select
              value={form.village}
              onChange={(e) => set("village", e.target.value)}
              className={inputClass}
            >
              {villages.map((v) => (
                <option key={v} value={v} className="bg-zinc-900">
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Année */}
          <div>
            <label className={labelClass}>Année</label>
            <input
              type="text"
              required
              value={form.year}
              onChange={(e) => set("year", e.target.value)}
              placeholder="Ex : 1902"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Description de la photo…"
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Type */}
          <div>
            <label className={labelClass}>Type</label>
            <input
              type="text"
              required
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              placeholder="Ex : Photo ancienne, Archive historique…"
              className={inputClass}
            />
          </div>

          {/* Restaurée */}
          <div className="flex items-center gap-4">
            <input
              id="restored"
              type="checkbox"
              checked={form.restored}
              onChange={(e) => set("restored", e.target.checked)}
              className="w-5 h-5 accent-cyan-300 cursor-pointer"
            />
            <label
              htmlFor="restored"
              className="text-sm uppercase tracking-[0.2em] text-white/70 cursor-pointer"
            >
              Photo restaurée
            </label>
          </div>

          {/* Image */}
          <div>
            <label className={labelClass}>Image</label>
            <input
              type="file"
              required
              accept="image/*"
              onChange={(e) => set("file", e.target.files?.[0] ?? null)}
              className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-white/20 file:bg-white/5 file:text-white/70 file:text-xs file:uppercase file:tracking-[0.2em] file:cursor-pointer hover:file:bg-white/10 file:transition-all"
            />
            {form.file && (
              <p className="mt-2 text-xs text-white/40">{form.file.name}</p>
            )}
          </div>

          {/* Feedback */}
          {status === "error" && (
            <p className="text-red-400 text-sm uppercase tracking-[0.2em]">
              Erreur : {errorMsg}
            </p>
          )}
          {status === "success" && (
            <p className="text-cyan-300 text-sm uppercase tracking-[0.2em]">
              Photo ajoutée avec succès.
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-4 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "Envoi en cours…" : "Ajouter la photo"}
          </button>
        </form>
      </div>
    </div>
  );
}
