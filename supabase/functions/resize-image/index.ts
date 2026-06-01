/**
 * Edge Function : resize-image
 * Reçoit une image en multipart/form-data, génère 3 tailles AVIF
 * et stocke l'original dans le bucket privé photos-originals.
 *
 * POST /functions/v1/resize-image
 * Body : multipart/form-data  { file: File }
 * Auth : Bearer <jwt>
 * Response : { ok: true, path: "uuid.avif" }
 *          | { ok: false, error: "message" }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { decode as decodeJpeg }                      from "npm:@jsquash/jpeg";
import { decode as decodePng }                       from "npm:@jsquash/png";
import { decode as decodeWebp }                      from "npm:@jsquash/webp";
import { decode as decodeAvif, encode as encodeAvif } from "npm:@jsquash/avif";
import resize                                         from "npm:@jsquash/resize";

// ── Constantes ─────────────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

/** Origines autorisées pour CORS. */
const ALLOWED_ORIGINS = [
  "https://photoplombieres.eu",
  "https://portfolio-commune.vercel.app",
];

/**
 * Tailles cibles.
 * cqLevel : paramètre natif libaom — 0 (meilleur) → 63 (pire).
 * Conversion : cqLevel = round(63 × (1 − quality/100))
 *   quality 75 → cqLevel 16
 *   quality 82 → cqLevel 11
 *   quality 90 → cqLevel  6
 */
const SIZES = [
  { folder: "thumb",  width: 400,  cqLevel: 16 },
  { folder: "medium", width: 900,  cqLevel: 11 },
  { folder: "full",   width: 1920, cqLevel:  6 },
] as const;

// ── Helpers CORS ───────────────────────────────────────────────────────────

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}

// ── Helpers réponse ────────────────────────────────────────────────────────

function jsonResponse(
  cors: Record<string, string>,
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── Décodage image → ImageData brut ───────────────────────────────────────

interface RawImageData {
  data:   Uint8ClampedArray;
  width:  number;
  height: number;
}

async function decodeImage(
  bytes: Uint8Array,
  mime: string,
): Promise<RawImageData> {
  switch (mime) {
    case "image/jpeg": return decodeJpeg(bytes) as Promise<RawImageData>;
    case "image/png":  return decodePng(bytes)  as Promise<RawImageData>;
    case "image/webp": return decodeWebp(bytes)  as Promise<RawImageData>;
    case "image/avif": return decodeAvif(bytes)  as Promise<RawImageData>;
    default: throw new Error(`Format non supporté : ${mime}`);
  }
}

// ── Redimensionnement (jamais d'agrandissement) ────────────────────────────

async function resizeTo(
  src: RawImageData,
  targetWidth: number,
): Promise<RawImageData> {
  if (src.width <= targetWidth) return src; // image déjà plus petite → inchangée

  const targetHeight = Math.round(src.height * targetWidth / src.width);
  return resize(src, { width: targetWidth, height: targetHeight }) as Promise<RawImageData>;
}

// ── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors   = buildCorsHeaders(origin);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse(cors, 405, { ok: false, error: "Méthode non autorisée" });
  }

  // ── 1. Vérification du JWT ───────────────────────────────────────────────

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(cors, 401, { ok: false, error: "Non authentifié" });
  }

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SECRET_KEYS")!;

  // Client utilisateur : vérifie que le token est valide
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse(cors, 401, { ok: false, error: "Non authentifié" });
  }

  // Client service role : opérations Storage uniquement
  const storage = createClient(supabaseUrl, serviceRoleKey).storage;

  // ── 2. Lecture et validation du fichier ──────────────────────────────────

  let fileBytes: Uint8Array;
  let mimeType: string;

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("Champ 'file' manquant ou invalide");
    }

    mimeType = file.type;
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new Error(
        `Type non accepté : ${mimeType}. Formats acceptés : jpeg, png, webp, avif`,
      );
    }

    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error("Fichier trop volumineux (max 10 Mo)");
    }

    fileBytes = new Uint8Array(buffer);
  } catch (e) {
    return jsonResponse(cors, 400, { ok: false, error: (e as Error).message });
  }

  // ── 3. Identifiant unique ────────────────────────────────────────────────

  const uuid     = crypto.randomUUID();
  const filename = `${uuid}.avif`;

  // ── 4. Décodage de l'image source ───────────────────────────────────────

  let source: RawImageData;
  try {
    source = await decodeImage(fileBytes, mimeType);
  } catch (e) {
    console.error("[resize-image] décodage :", (e as Error).message);
    return jsonResponse(cors, 422, {
      ok: false,
      error: "Impossible de décoder l'image. Vérifiez que le fichier n'est pas corrompu.",
    });
  }

  // ── 5. Génération des 3 tailles + upload ────────────────────────────────

  // Liste des fichiers uploadés — utilisée pour le rollback en cas d'erreur.
  const uploaded: Array<{ bucket: string; path: string }> = [];

  try {
    for (const size of SIZES) {
      const resized = await resizeTo(source, size.width);

      const avifBuffer = await encodeAvif(
        { data: resized.data, width: resized.width, height: resized.height },
        { cqLevel: size.cqLevel, speed: 6 },
      );

      const path = `${size.folder}/${filename}`;

      const { error } = await storage.from("photos").upload(
        path,
        avifBuffer,
        { contentType: "image/avif", cacheControl: "31536000", upsert: false },
      );

      if (error) throw new Error(`Upload ${size.folder} : ${error.message}`);
      uploaded.push({ bucket: "photos", path });
    }

    // Original dans le bucket privé (toujours en dernier)
    const { error: origError } = await storage.from("photos-originals").upload(
      filename,
      fileBytes,
      { contentType: mimeType, cacheControl: "31536000", upsert: false },
    );

    if (origError) throw new Error(`Upload original : ${origError.message}`);

  } catch (e) {
    // Rollback : supprimer les fichiers déjà uploadés pour éviter les orphelins
    if (uploaded.length > 0) {
      const byBucket = uploaded.reduce<Record<string, string[]>>((acc, f) => {
        acc[f.bucket] = [...(acc[f.bucket] ?? []), f.path];
        return acc;
      }, {});

      await Promise.all(
        Object.entries(byBucket).map(([bucket, paths]) =>
          storage.from(bucket).remove(paths).catch(() => {
            // échec du rollback non bloquant — loggé sans données sensibles
            console.error(`[resize-image] rollback échoué pour bucket "${bucket}"`);
          }),
        ),
      );
    }

    console.error("[resize-image] upload :", (e as Error).message);
    return jsonResponse(cors, 500, { ok: false, error: (e as Error).message });
  }

  // ── 6. Succès ────────────────────────────────────────────────────────────

  return jsonResponse(cors, 200, { ok: true, path: filename });
});
