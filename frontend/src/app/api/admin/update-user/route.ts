import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");

  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", caller.id).single();
  if (!callerProfile || callerProfile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { targetUserId, firstName, lastName, email, password } = body as {
    targetUserId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
  };

  if (!targetUserId) return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });

  const results: Record<string, unknown> = {};

  if (firstName !== undefined || lastName !== undefined) {
    const update: Record<string, string> = {};
    if (firstName !== undefined) update.first_name = firstName.trim();
    if (lastName  !== undefined) update.last_name  = lastName.trim();
    const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", targetUserId);
    results.profile = error ? { error: error.message } : { success: true };
  }

  if (email !== undefined && email.trim() !== "") {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      email: email.trim().toLowerCase(),
      email_confirm: true,
    });
    if (!error) {
      await supabaseAdmin.from("profiles")
        .update({ email: email.trim().toLowerCase() }).eq("id", targetUserId);
    }
    results.email = error ? { error: error.message } : { success: true };
  }

  if (password !== undefined && password.length >= 8) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
    results.password = error ? { error: error.message } : { success: true };
  }

  return NextResponse.json({ success: true, results });
}
