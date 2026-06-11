import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadOriginalToR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  // Auth : vérifier que l'utilisateur est admin/moderator
  const authHeader = req.headers.get("authorization");
  if (!authHeader)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "moderator"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Récupérer le fichier
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const key = formData.get("key") as string | null;
  if (!file || !key)
    return NextResponse.json({ error: "Missing file or key" }, { status: 400 });

  // Upload vers R2
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadOriginalToR2(key, buffer, file.type);

  return NextResponse.json({ success: true, key, location: "r2" });
}
