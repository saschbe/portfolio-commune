import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteOriginalFromR2 } from "@/lib/r2";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "moderator"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { key, originalLocation } = body as { key: string; originalLocation: "supabase" | "r2" };

  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const variantsResult = await supabaseAdmin.storage.from("photos").remove([
    `thumb/${key}`,
    `medium/${key}`,
    `full/${key}`,
  ]);

  let originalResult: { error: string | null } = { error: null };
  if (originalLocation === "supabase") {
    const { error } = await supabaseAdmin.storage.from("photos-originals").remove([key]);
    originalResult.error = error?.message ?? null;
  } else {
    try {
      await deleteOriginalFromR2(key);
    } catch (e) {
      originalResult.error = (e as Error).message;
    }
  }

  return NextResponse.json({
    success: true,
    variants: variantsResult,
    original: originalResult,
  });
}
