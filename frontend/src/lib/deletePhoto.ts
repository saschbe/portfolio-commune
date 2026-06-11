import { supabase } from "@/lib/supabase";

export async function deletePhotoFiles(
  src: string,
  originalLocation: "supabase" | "r2" = "supabase",
): Promise<void> {
  const filename = src.startsWith("http") ? (src.split("/").pop() ?? "") : src;
  if (!filename) return;

  const webpName = filename.endsWith(".webp")
    ? filename
    : filename.replace(/\.[^.]+$/, ".webp");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch("/api/delete-original", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key: webpName, originalLocation }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Suppression fichiers : ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log("[deletePhotoFiles] result:", result);

  if (result.original?.error) {
    console.warn("[deletePhotoFiles] original delete warning:", result.original.error);
  }
}
