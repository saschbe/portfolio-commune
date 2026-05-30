import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ success: false, error: "Token manquant" }, { status: 400 });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ success: false, error: "Configuration serveur manquante" }, { status: 500 });
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  const data = await res.json() as { success: boolean };

  if (!data.success) {
    return NextResponse.json({ success: false, error: "Vérification échouée" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
