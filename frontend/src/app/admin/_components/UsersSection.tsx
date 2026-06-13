"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logActivite } from "@/lib/logActivite";

type Profile = {
  id: string;
  role: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
};

const roles = ["user", "moderator", "admin"] as const;

function roleBadgeClass(role: string) {
  if (role === "admin")     return "text-cyan-300 border-cyan-300/30 bg-cyan-300/10";
  if (role === "moderator") return "text-amber-300 border-amber-300/30 bg-amber-300/10";
  return "text-white/40 border-white/10 bg-white/5";
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-300/50 transition-all";
const labelClass =
  "block text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2";

export default function UsersSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("");

  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editStatus, setEditStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [editMsg, setEditMsg] = useState("");

  useEffect(() => {
    loadProfiles();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setCurrentRole(p?.role ?? "");
    });
  }, []);

  async function loadProfiles() {
    const { data, error } = await supabase.from("profiles").select("*").order("role");
    if (error) console.error("[users] loadProfiles:", error);
    setProfiles(data ?? []);
    setLoading(false);
  }

  async function handleRoleChange(id: string, newRole: string) {
    setUpdatingId(id);
    setUpdateError(null);
    try {
      const { data, error } = await supabase
        .from("profiles").update({ role: newRole }).eq("id", id).select();
      if (error) { setUpdateError(`Erreur : ${error.message}`); return; }
      if (!data || data.length === 0) {
        setUpdateError("Aucune ligne mise à jour — vérifiez les politiques RLS de la table profiles.");
        return;
      }
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role: newRole } : p)));
    } finally {
      setUpdatingId(null);
    }
  }

  function openEdit(profile: Profile) {
    setEditingUser(profile);
    setEditFirstName(profile.first_name ?? "");
    setEditLastName(profile.last_name ?? "");
    setEditEmail("");
    setEditPassword("");
    setEditStatus("idle");
    setEditMsg("");
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    setEditStatus("loading");
    setEditMsg("");

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const body: Record<string, string> = { targetUserId: editingUser.id };
    if (editFirstName !== (editingUser.first_name ?? "")) body.firstName = editFirstName;
    if (editLastName  !== (editingUser.last_name  ?? "")) body.lastName  = editLastName;
    if (editEmail.trim() !== "")  body.email    = editEmail;
    if (editPassword !== "")      body.password = editPassword;

    const res = await fetch("/api/admin/update-user", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json() as { error?: string; results?: Record<string, unknown> };
    if (!res.ok) {
      setEditMsg(`Erreur : ${result.error ?? "inconnue"}`);
      setEditStatus("error");
      return;
    }

    await logActivite({
      type: "user_modifie",
      description: `Profil modifié pour ${editingUser.email}`,
      actor_id: session?.user?.id,
      meta: {
        target_user_id: editingUser.id,
        target_email: editingUser.email,
        changed: Object.keys(body).filter((k) => k !== "targetUserId"),
      },
    });

    setEditMsg("Modifications enregistrées.");
    setEditStatus("success");
    await loadProfiles();
    setTimeout(() => setEditingUser(null), 1200);
  }

  return (
    <div>
      <h2 className="text-2xl font-light uppercase tracking-[0.15em] mb-2">
        Utilisateurs
      </h2>
      <p className="text-white/30 text-xs uppercase tracking-[0.25em] mb-8">
        {profiles.length} compte{profiles.length !== 1 ? "s" : ""}
      </p>

      {updateError && (
        <p className="mb-6 text-red-400 text-xs uppercase tracking-[0.2em]">{updateError}</p>
      )}

      {loading ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">Chargement…</p>
      ) : profiles.length === 0 ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">Aucun utilisateur.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-4 bg-white/2 border border-white/10 rounded-2xl px-5 py-4 hover:border-white/20 transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {profile.display_name || (profile.email ?? profile.id)}
                </p>
                {profile.display_name && profile.email && (
                  <p className="text-xs text-white/40 truncate mt-0.5">{profile.email}</p>
                )}
              </div>

              <span className={`hidden sm:block px-3 py-1 rounded-full border text-xs uppercase tracking-[0.2em] shrink-0 ${roleBadgeClass(profile.role)}`}>
                {profile.role}
              </span>

              {currentRole === "admin" && (
                <button
                  onClick={() => openEdit(profile)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs uppercase tracking-[0.15em] hover:border-cyan-300/40 hover:text-cyan-300 transition-all shrink-0"
                >
                  Modifier
                </button>
              )}

              <select
                value={profile.role}
                onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                disabled={updatingId === profile.id}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs uppercase tracking-[0.15em] focus:outline-none focus:border-cyan-300/50 transition-all disabled:opacity-40 cursor-pointer shrink-0"
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-zinc-900">{r}</option>
                ))}
              </select>

              {updatingId === profile.id && (
                <span className="text-xs text-white/30 shrink-0">…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal édition */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="text-cyan-300 text-[10px] uppercase tracking-[0.35em]">
                Modifier l&apos;utilisateur
              </p>
              <button
                onClick={() => setEditingUser(null)}
                className="text-white/30 hover:text-white text-2xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/50 mb-5 font-mono break-all">
              {editingUser.email ?? editingUser.id}
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Prénom</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Nom</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Nouvel email{" "}
                  <span className="text-white/30 normal-case tracking-normal">
                    (vide = ne pas changer)
                  </span>
                </label>
                <input
                  type="email"
                  autoComplete="off"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder={editingUser.email}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Nouveau mot de passe{" "}
                  <span className="text-white/30 normal-case tracking-normal">
                    (min 8 car., vide = ne pas changer)
                  </span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  minLength={8}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Mot de passe temporaire à communiquer"
                  className={`${inputClass} font-mono`}
                />
                <p className="text-[10px] text-amber-400/70 mt-2 leading-relaxed">
                  Le mot de passe est affiché en clair pour pouvoir le copier et le communiquer. L&apos;utilisateur pourra le changer depuis «&nbsp;Mon compte&nbsp;».
                </p>
              </div>

              {editMsg && (
                <p className={`text-[11px] ${editStatus === "error" ? "text-red-400" : "text-emerald-400"}`}>
                  {editMsg}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-full border border-white/15 text-white/60 text-[10px] uppercase tracking-[0.2em] hover:border-white/40 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editStatus === "loading"}
                  className="px-5 py-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 text-[10px] uppercase tracking-[0.25em] hover:bg-cyan-300/20 disabled:opacity-30 transition-all"
                >
                  {editStatus === "loading" ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
