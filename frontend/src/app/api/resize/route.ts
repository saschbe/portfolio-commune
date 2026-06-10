import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 10 * 1024 * 1024;

const SIZES = [
  { folder: "thumb",  width: 400,  quality: 75 },
  { folder: "medium", width: 900,  quality: 82 },
  { folder: "full",   width: 1920, quality: 90 },
] as const;

export async function POST(request: Request) {
  // ── 1. Vérification JWT ────────────────────────────────────────────────────

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
  }

  // ── 2. Lecture et validation du fichier ───────────────────────────────────

  let fileBuffer: Buffer;
  let mimeType: string;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Champ 'file' manquant" }, { status: 400 });
    }

    mimeType = file.type;
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json(
        { ok: false, error: `Type non accepté : ${mimeType}` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Fichier trop volumineux (max 10 Mo)" },
        { status: 400 },
      );
    }

    fileBuffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json({ ok: false, error: "Erreur de lecture du fichier" }, { status: 400 });
  }

  // ── 3. UUID ───────────────────────────────────────────────────────────────

  const uuid     = crypto.randomUUID();
  const filename = `${uuid}.avif`;

  // ── 4. Métadonnées de l'image source ─────────────────────────────────────

  let srcWidth: number;
  try {
    const meta = await sharp(fileBuffer).metadata();
    srcWidth = meta.width ?? 0;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Impossible de lire l'image" },
      { status: 422 },
    );
  }

  // ── 5. Génération des 3 tailles AVIF + upload ─────────────────────────────

  const storage = createClient(supabaseUrl, serviceRoleKey).storage;
  const uploaded: Array<{ bucket: string; path: string }> = [];

  try {
    for (const size of SIZES) {
      const avifBuffer = await sharp(fileBuffer)
        .resize(
          srcWidth <= size.width ? undefined : size.width,
          null,
          { withoutEnlargement: true },
        )
        .avif({ quality: size.quality })
        .toBuffer();

      const path = `${size.folder}/${filename}`;
      const { error } = await storage.from("photos").upload(path, avifBuffer, {
        contentType: "image/avif",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error(`Upload ${size.folder} : ${error.message}`);
      uploaded.push({ bucket: "photos", path });
    }

    // Original dans le bucket privé
    const { error: origError } = await storage.from("photos-originals").upload(
      filename,
      fileBuffer,
      { contentType: mimeType, cacheControl: "31536000", upsert: false },
    );
    if (origError) throw new Error(`Upload original : ${origError.message}`);

  } catch (e) {
    // Rollback — supprimer les fichiers déjà uploadés
    if (uploaded.length > 0) {
      const byBucket = uploaded.reduce<Record<string, string[]>>((acc, f) => {
        acc[f.bucket] = [...(acc[f.bucket] ?? []), f.path];
        return acc;
      }, {});
      await Promise.all(
        Object.entries(byBucket).map(([bucket, paths]) =>
          storage.from(bucket).remove(paths).catch(() => {}),
        ),
      );
    }
    console.error("[api/resize]", (e as Error).message);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }

  // ── 6. Succès ─────────────────────────────────────────────────────────────

  return NextResponse.json({ ok: true, path: filename });
}
