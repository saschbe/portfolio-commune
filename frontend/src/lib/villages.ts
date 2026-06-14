export const VILLAGES_HAMEAUX: Record<string, string[]> = {
  "Gemmenich":   ["Völkerich"],
  "Hombourg":    ["Gulpen"],
  "Montzen":     ["Montzen-Gare"],
  "Moresnet":    ["Moresnet-Chapelle"],
  "Sippenaeken": ["Terbruggen", "Beusdael"],
  "Plombières":  [],
};
export const VILLAGES = Object.keys(VILLAGES_HAMEAUX);

export const VILLAGE_CENTERS: Record<string, { lat: number; lng: number }> = {
  Gemmenich: { lat: 50.7467, lng: 5.9955 },
  Hombourg: { lat: 50.7226, lng: 5.9205 },
  Montzen: { lat: 50.7074, lng: 5.9618 },
  Moresnet: { lat: 50.7201, lng: 5.9892 },
  Sippenaeken: { lat: 50.7508, lng: 5.9335 },
  Plombières: { lat: 50.7361, lng: 5.9586 },
};
