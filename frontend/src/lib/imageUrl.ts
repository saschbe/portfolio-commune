export type ImageSize = "thumb" | "medium" | "full";

export const IMAGE_SIZES: Record<ImageSize, { width: number; quality: number }> = {
  thumb:  { width: 400,  quality: 75 },
  medium: { width: 900,  quality: 80 },
  full:   { width: 1920, quality: 90 },
};

/** Retourne l'URL originale. Next.js <Image> applique la transformation. */
export function imageUrl(src: string | null | undefined): string {
  if (!src) return "/images/placeholder.jpg";
  return src;
}

/** Retourne { width, quality } à passer comme props à <Image>. */
export function imageProps(size: ImageSize) {
  return IMAGE_SIZES[size];
}
