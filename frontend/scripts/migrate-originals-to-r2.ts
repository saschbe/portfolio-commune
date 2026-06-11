import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !R2_ENDPOINT || !R2_KEY || !R2_SECRET || !R2_BUCKET) {
  console.error("✗ Missing env vars. Check frontend/.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_KEY, secretAccessKey: R2_SECRET },
});

const SUPABASE_BUCKET = "photos-originals";

async function listAllSupabaseOriginals(): Promise<Map<string, string>> {
  const fileMap = new Map<string, string>();
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list("", { limit: pageSize, offset });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const f of data) {
      const uuid = f.name.split(".")[0];
      fileMap.set(uuid, f.name);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return fileMap;
}

async function migrate() {
  console.log("→ Listing Supabase photos-originals files...");
  const fileMap = await listAllSupabaseOriginals();
  console.log(`  Found ${fileMap.size} file(s) in Supabase bucket.`);

  console.log("→ Querying DB for photos to migrate...");
  const { data: photos, error } = await supabase
    .from("photos")
    .select("id, src, title")
    .eq("original_location", "supabase");

  if (error) throw error;
  console.log(`  Found ${photos.length} photo(s) in DB with original_location=supabase.\n`);

  let success = 0, skippedTypeB = 0, notFound = 0, failed = 0;

  for (const photo of photos) {
    const isTypeB = photo.src.startsWith("http");
    if (isTypeB) {
      console.log(`⚠ [Type B - skipped] ${photo.title} (${photo.id})`);
      skippedTypeB++;
      continue;
    }

    const srcUuid = photo.src.split(".")[0];
    const actualFilename = fileMap.get(srcUuid);

    if (!actualFilename) {
      console.log(`✗ [Not in Supabase] ${photo.title} — src=${photo.src}`);
      notFound++;
      continue;
    }

    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(actualFilename);
      if (dlError || !blob) throw new Error(`Download failed: ${dlError?.message}`);

      const buffer = Buffer.from(await blob.arrayBuffer());
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: actualFilename,
        Body: buffer,
        ContentType: blob.type || "application/octet-stream",
      }));

      const { error: updateError } = await supabase
        .from("photos")
        .update({ original_location: "r2" })
        .eq("id", photo.id);
      if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

      console.log(`✓ Migrated: ${actualFilename} (${(buffer.length / 1024).toFixed(0)} KB)`);
      success++;
    } catch (e) {
      console.log(`✗ Failed: ${photo.title} — ${(e as Error).message}`);
      failed++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`✓ Success:        ${success}`);
  console.log(`⚠ Type B skipped: ${skippedTypeB}`);
  console.log(`✗ Not in bucket:  ${notFound}`);
  console.log(`✗ Failed:         ${failed}`);
  console.log("\nNothing was deleted from Supabase. Verify in R2 dashboard, then cleanup manually.");
}

migrate().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});
