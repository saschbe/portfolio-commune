export type ImageSize = "thumb" | "medium" | "full";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("[imageUrl] NEXT_PUBLIC_SUPABASE_URL manquant");
}

const STORAGE_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") +
  "/storage/v1/object/public/photos";

const IMAGE_PROPS: Record<ImageSize, { width: number; sizes: string }> = {
  thumb:  { width: 400,  sizes: "(max-width: 768px) 100vw, 400px" },
  medium: { width: 900,  sizes: "(max-width: 768px) 100vw, 900px" },
  full:   { width: 1920, sizes: "100vw" },
};

/**
 * Construit l'URL publique d'une image depuis son chemin relatif.
 * src = "uuid.avif" — jamais une URL complète dans les nouvelles photos.
 * Compatibilité : les anciennes photos stockent une URL absolue Supabase,
 * elles sont retournées telles quelles jusqu'à la migration.
 */
export function imageUrl(
  src: string | null | undefined,
  size: ImageSize = "full",
): string {
  if (!src) return "/images/placeholder.jpg";
  if (src.startsWith("http")) return src; // URL complète legacy
  return `${STORAGE_BASE}/${size}/${src}`;
}

/** Retourne { width, sizes } à passer comme props à <Image>. */
export function imageProps(size: ImageSize) {
  return IMAGE_PROPS[size];
}
