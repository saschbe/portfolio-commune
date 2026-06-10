import { supabase } from "@/lib/supabase";

/**
 * Supprime une photo dans tous les buckets.
 * src = "uuid.webp" (nouvelles photos) ou URL complète Supabase (legacy).
 */
export async function deletePhotoFiles(src: string): Promise<void> {
  const filename = src.startsWith("http")
    ? (src.split("/").pop() ?? "")
    : src;

  if (!filename) return;

  const webpName = filename.endsWith(".webp")
    ? filename
    : filename.replace(/\.[^.]+$/, ".webp");

  await Promise.allSettled([
    supabase.storage.from("photos").remove([`thumb/${webpName}`]),
    supabase.storage.from("photos").remove([`medium/${webpName}`]),
    supabase.storage.from("photos").remove([`full/${webpName}`]),
    supabase.storage.from("photos-originals").remove([filename]),
    // Compatibilité anciennes photos stockées à la racine du bucket
    supabase.storage.from("photos").remove([filename]),
  ]);
}
