export type ImageSize = "thumb" | "medium" | "full";

const SIZES: Record<ImageSize, { width: number; quality: number }> = {
  thumb:  { width: 400,  quality: 75 },
  medium: { width: 900,  quality: 80 },
  full:   { width: 1920, quality: 90 },
};

function transformUrl(src: string, width: number, quality: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

export function imageUrl(src: string | null | undefined, size: ImageSize = "full"): string {
  if (!src) return "/images/placeholder.jpg";
  try {
    const { width, quality } = SIZES[size];
    return transformUrl(src, width, quality);
  } catch {
    return src;
  }
}
