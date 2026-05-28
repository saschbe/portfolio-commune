"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string;
  email?: string;
};

const roles = ["user", "moderator", "admin"] as const;

function roleBadgeClass(role: string) {
  if (role === "admin")
    return "text-cyan-300 border-cyan-300/30 bg-cyan-300/10";
  if (role === "moderator")
    return "text-amber-300 border-amber-300/30 bg-amber-300/10";
  return "text-white/40 border-white/10 bg-white/5";
}

export default function UsersSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role");
    if (error) console.error("[users] loadProfiles:", error);
    setProfiles(data ?? []);
    setLoading(false);
  }

  async function handleRoleChange(id: string, newRole: string) {
    setUpdatingId(id);
    setUpdateError(null);
    console.log("[users] update role — id:", id, "→", newRole);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", id)
        .select();
      console.log("[users] update role — response:", { data, error });
      if (error) {
        setUpdateError(`Erreur : ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        const msg = "Aucune ligne mise à jour — vérifiez les politiques RLS de la table profiles.";
        console.warn("[users]", msg);
        setUpdateError(msg);
        return;
      }
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, role: newRole } : p))
      );
    } finally {
      setUpdatingId(null);
    }
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
        <p className="mb-6 text-red-400 text-xs uppercase tracking-[0.2em]">
          {updateError}
        </p>
      )}

      {loading ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Chargement…
        </p>
      ) : profiles.length === 0 ? (
        <p className="text-white/30 uppercase tracking-[0.3em] text-xs py-8">
          Aucun utilisateur.
        </p>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-4 hover:border-white/20 transition-all"
            >
              {/* Identity */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white/70 truncate">
                  {profile.email ?? profile.id}
                </p>
                {profile.email && (
                  <p className="text-xs text-white/25 font-mono truncate mt-0.5">
                    {profile.id}
                  </p>
                )}
              </div>

              {/* Current role badge */}
              <span
                className={`hidden sm:block px-3 py-1 rounded-full border text-xs uppercase tracking-[0.2em] shrink-0 ${roleBadgeClass(profile.role)}`}
              >
                {profile.role}
              </span>

              {/* Role selector */}
              <select
                value={profile.role}
                onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                disabled={updatingId === profile.id}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs uppercase tracking-[0.15em] focus:outline-none focus:border-cyan-300/50 transition-all disabled:opacity-40 cursor-pointer shrink-0"
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-zinc-900">
                    {r}
                  </option>
                ))}
              </select>

              {updatingId === profile.id && (
                <span className="text-xs text-white/30 shrink-0">…</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
