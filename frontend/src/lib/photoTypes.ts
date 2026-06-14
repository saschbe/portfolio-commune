export const PHOTO_TYPES = [
  "Ancienne",
  "Carte postale",
  "Guerre",
  "Aérienne",
  "Événement",
  "Portrait",
  "École",
  "Commerce",
  "Industrie",
  "Mine",
  "Rue",
  "Bâtiment",
  "Fête locale",
  "Transport",
  "Vie quotidienne",
] as const;

export function parsePhotoTypes(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(/[;,|]/)
    .map((type) => type.trim())
    .filter(Boolean);
}

export function formatPhotoTypes(types: string[]): string {
  return Array.from(new Set(types.map((type) => type.trim()).filter(Boolean)))
    .join(", ");
}

export function togglePhotoType(value: string, type: string): string {
  const current = parsePhotoTypes(value);
  const next = current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type];

  return formatPhotoTypes(next);
}

export function photoHasType(value: string | null | undefined, type: string) {
  return parsePhotoTypes(value)
    .map((item) => item.toLowerCase())
    .includes(type.toLowerCase());
}
