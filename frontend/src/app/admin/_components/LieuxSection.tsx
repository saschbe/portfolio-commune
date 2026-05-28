"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const villages = [
  "Plombières",
  "Gemmenich",
  "Hombourg",
  "Moresnet",
  "Montzen",
  "Sippenaeken",
];

const types = [
  "Site naturel",
  "Bâtiment historique",
  "Point de repère",
  "Site religieux",
  "Hameau",
];

type Lieu = {
  id: string;
  nom: string;
  village: string;
  type: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
};

type FormState = {
  nom: string;
  village: string;
  type: string;
  description: string;
  latitude: string;
  longitude: string;
  url: string;
};

const defaultForm: FormState = {
  nom: "",
  village: villages[0],
  type: types[0],
  description: "",
  latitude: "",
  longitude: "",
  url: "",
};

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200";
const labelClass =
  "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

function LieuForm({
  initial,
  onSave,
  onCancel,
  saveLabel,
  saving,
  error,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel?: () => void;
  saveLabel: string;
  saving: boolean;
  error: string;
}) {
  const [f, setF] = useState<FormState>(initial);
  function set<K extends keyof FormState>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(f); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nom</label>
          <input
            type="text"
            required
            value={f.nom}
            onChange={(e) => set("nom", e.target.value)}
            placeholder="Ex : Château de Sippenaeken"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Village</label>
          <select
            value={f.village}
            onChange={(e) => set("village", e.target.value)}
            className={inputClass}
          >
            {villages.map((v) => (
              <option key={v} value={v} className="bg-zinc-900">{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={f.type}
            onChange={(e) => set("type", e.target.value)}
            className={inputClass}
          >
            {types.map((t) => (
              <option key={t} value={t} className="bg-zinc-900">{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>URL <span className="text-white/25">(optionnel)</span></label>
          <input
            type="url"
            value={f.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Latitude</label>
          <input
            type="number"
            step="any"
            value={f.latitude}
            onChange={(e) => set("latitude", e.target.value)}
            placeholder="50.7382"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Longitude</label>
          <input
            type="number"
            step="any"
            value={f.longitude}
            onChange={(e) => set("longitude", e.target.value)}
            placeholder="5.9584"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          required
          rows={3}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Description du lieu…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs uppercase tracking-[0.2em]">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.25em] text-xs hover:bg-cyan-300/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement…" : saveLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-full border border-white/10 text-white/40 uppercase tracking-[0.25em] text-xs hover:border-white/20 hover:text-white/60 transition-all"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function LieuxSection() {
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState(false);
  const [editLieu, setEditLieu] = useState<Lieu | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadLieux();
  }, []);

  async function loadLieux() {
    const { data, error } = await supabase
      .from("lieux")
      .select("*")
      .order("village")
      .order("nom");
    if (error) console.error("[lieux] load:", error);
    setLieux(data ?? []);
    setLoading(false);
  }

  function lieuToForm(l: Lieu): FormState {
    return {
      nom: l.nom,
      village: l.village,
      type: l.type,
      description: l.description,
      latitude: l.latitude != null ? String(l.latitude) : "",
      longitude: l.longitude != null ? String(l.longitude) : "",
      url: l.url ?? "",
    };
  }

  function formToPayload(f: FormState) {
    return {
      nom: f.nom,
      village: f.village,
      type: f.type,
      description: f.description,
      latitude: f.latitude !== "" ? parseFloat(f.latitude) : null,
      longitude: f.longitude !== "" ? parseFloat(f.longitude) : null,
      url: f.url !== "" ? f.url : null,
    };
  }

  async function handleAdd(f: FormState) {
    setAddSaving(true);
    setAddError("");
    setAddSuccess(false);
    const { error } = await supabase.from("lieux").insert(formToPayload(f));
    if (error) {
      console.error("[lieux] add:", error);
      setAddError(error.message);
      setAddSaving(false);
      return;
    }
    setAddSaving(false);
    setAddSuccess(true);
    setShowAddForm(false);
    await loadLieux();
  }

  async function handleEditSave(f: FormState) {
    if (!editLieu) return;
    setEditSaving(true);
    setEditError("");
    const { error } = await supabase
      .from("lieux")
      .update(formToPayload(f))
      .eq("id", editLieu.id);
    if (error) {
      console.error("[lieux] edit:", error);
      setEditError(error.message);
      setEditSaving(false);
      return;
    }
    setEditSaving(false);
    setEditLieu(null);
    await loadLieux();
  }

  async function handleDelete(lieu: Lieu) {
    if (!window.confirm(`Supprimer "${lieu.nom}" ?`)) return;
    setDeletingId(lieu.id);
    const { error } = await supabase
      .from("lieux")
      .delete()
      .eq("id", lieu.id);
    if (error) console.error("[lieux] delete:", error);
    setDeletingId(null);
    await loadLieux();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-light uppercase tracking-[0.15em]">Lieux</h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setAddError("");
            setAddSuccess(false);
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
            Nouveau lieu
          </p>
          <LieuForm
            initial={defaultForm}
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saveLabel="Ajouter le lieu"
            saving={addSaving}
            error={addError}
          />
        </div>
      )}

      {addSuccess && !showAddForm && (
        <div className="mb-6 bg-emerald-400/5 border border-emerald-400/20 rounded-2xl px-5 py-3">
          <p className="text-emerald-400 text-xs uppercase tracking-[0.25em]">
            Lieu ajouté avec succès.
          </p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Chargement…
        </p>
      ) : lieux.length === 0 ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Aucun lieu.
        </p>
      ) : (
        <div className="space-y-2">
          {lieux.map((lieu) => (
            <div
              key={lieu.id}
              className="flex items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 hover:border-white/20 transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lieu.nom}</p>
                <p className="text-xs text-white/40 uppercase tracking-[0.15em] mt-0.5">
                  {lieu.village} · {lieu.type}
                </p>
              </div>
              {lieu.latitude != null && lieu.longitude != null && (
                <span className="hidden lg:block text-xs text-white/20 font-mono shrink-0">
                  {lieu.latitude.toFixed(4)}, {lieu.longitude.toFixed(4)}
                </span>
              )}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditLieu(lieu);
                    setEditError("");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs uppercase tracking-[0.15em] hover:border-cyan-300/40 hover:text-cyan-300 transition-all"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(lieu)}
                  disabled={deletingId === lieu.id}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs uppercase tracking-[0.15em] hover:border-red-400/40 hover:text-red-400 transition-all disabled:opacity-30"
                >
                  {deletingId === lieu.id ? "…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editLieu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Modifier le lieu
              </p>
              <button
                onClick={() => setEditLieu(null)}
                className="text-white/30 hover:text-white text-2xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>
            <LieuForm
              initial={lieuToForm(editLieu)}
              onSave={handleEditSave}
              onCancel={() => setEditLieu(null)}
              saveLabel="Enregistrer"
              saving={editSaving}
              error={editError}
            />
          </div>
        </div>
      )}
    </div>
  );
}
