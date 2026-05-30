import { supabase } from "@/lib/supabase";

export type LogType =
  | "photo_importee"
  | "photo_soumise"
  | "photo_approuvee"
  | "photo_rejetee"
  | "statut_modifie"
  | "photo_modifiee"
  | "photo_supprimee"
  | "signalement_traite";

export interface LogPayload {
  type: LogType;
  description: string;
  photo_id?: string | null;
  actor_id?: string | null;
  meta?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export async function logActivite(payload: LogPayload): Promise<void> {
  const { error } = await supabase.from("activites").insert({
    type:        payload.type,
    description: payload.description,
    photo_id:    payload.photo_id  ?? null,
    actor_id:    payload.actor_id  ?? null,
    meta:        payload.meta      ?? null,
    details:     payload.details   ?? null,
  });
  if (error) console.error("[logActivite] failed:", error.message);
}
