import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// ── Types ────────────────────────────────────────────────────────────────────

interface Activite {
  id: string;
  type: string;
  description: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

interface PhotoRow {
  id: string;
  title: string;
  village: string;
  year: string;
  type: string;
  status: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  role: string;
  created_at: string;
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toLocaleDateString("fr-BE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Récupérer les activités des dernières 24h
    const { data: activites, error: activitesError } = await supabase
      .from("activites")
      .select("id, type, description, meta, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (activitesError) throw new Error(`activites : ${activitesError.message}`);

    const allActivites = (activites ?? []) as Activite[];

    // Grouper par type
    const photoApprouvees = allActivites.filter((a) => a.type === "photo_approuvee");
    const photoRejetees   = allActivites.filter((a) => a.type === "photo_rejetee");
    const autresActivites = allActivites.filter(
      (a) => a.type !== "photo_approuvee" && a.type !== "photo_rejetee"
    );

    // 2. Nouveaux membres inscrits dans les dernières 24h
    const { data: newProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, role, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (profilesError) throw new Error(`profiles : ${profilesError.message}`);

    const newProfileRows = (newProfiles ?? []) as ProfileRow[];

    // Récupérer les emails des nouveaux membres via auth.admin
    const newMembers: { email: string; role: string; created_at: string }[] = [];
    for (const profile of newProfileRows) {
      const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
      if (user?.email) {
        newMembers.push({
          email: user.email,
          role: profile.role,
          created_at: profile.created_at,
        });
      }
    }

    // 3. Photos en attente (total actuel)
    const { data: pendingPhotos, error: pendingError } = await supabase
      .from("photos")
      .select("id, title, village, year, type, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingError) throw new Error(`photos pending : ${pendingError.message}`);

    const pendingRows = (pendingPhotos ?? []) as PhotoRow[];

    // Photos soumises dans les dernières 24h (toutes)
    const { data: recentPhotos } = await supabase
      .from("photos")
      .select("id, title, village, year, type, status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    const recentRows = (recentPhotos ?? []) as PhotoRow[];

    // 4. Récupérer les admins pour l'envoi
    const { data: adminProfiles, error: adminError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminError) throw new Error(`admin profiles : ${adminError.message}`);

    if (!adminProfiles?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Aucun admin trouvé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminRecipients: string[] = [];
    for (const ap of adminProfiles) {
      const { data: { user } } = await supabase.auth.admin.getUserById(ap.id);
      if (user?.email) adminRecipients.push(user.email);
    }

    if (!adminRecipients.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Aucune adresse admin trouvée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Envoi du rapport par email
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: "contact@photoplombieres.eu",
        pass: Deno.env.get("SMTP_PASSWORD")!,
      },
    });

    const subject = `Journal quotidien — Plombières en Images — ${today}`;
    const html = buildDigestHtml({
      today,
      newMembers,
      photoApprouvees,
      photoRejetees,
      pendingRows,
      recentRows,
      autresActivites,
    });

    for (const email of adminRecipients) {
      await transporter.sendMail({
        from: '"Plombières en Images" <contact@photoplombieres.eu>',
        to: email,
        subject,
        html,
      });
    }

    // 6. Enregistrer l'activité d'envoi
    await supabase.from("activites").insert({
      type: "digest_envoye",
      description: `Journal quotidien envoyé à ${adminRecipients.length} admin(s)`,
      meta: {
        date: today,
        recipients_count: adminRecipients.length,
        stats: {
          new_members: newMembers.length,
          photos_approuvees: photoApprouvees.length,
          photos_rejetees: photoRejetees.length,
          photos_en_attente: pendingRows.length,
        },
      },
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ sent: adminRecipients.length, date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-digest]", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── HTML email ────────────────────────────────────────────────────────────────

function buildDigestHtml(data: {
  today: string;
  newMembers: { email: string; role: string; created_at: string }[];
  photoApprouvees: Activite[];
  photoRejetees: Activite[];
  pendingRows: PhotoRow[];
  recentRows: PhotoRow[];
  autresActivites: Activite[];
}): string {
  const {
    today,
    newMembers,
    photoApprouvees,
    photoRejetees,
    pendingRows,
    recentRows,
    autresActivites,
  } = data;

  const stat = (value: number, label: string, color: string) => `
    <td style="text-align:center;padding:0 16px;">
      <div style="font-size:28px;font-weight:300;color:${color};letter-spacing:-0.02em;">${value}</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.35);margin-top:4px;">${label}</div>
    </td>`;

  const sectionTitle = (title: string, count: number, color = "#67e8f9") => `
    <tr><td style="padding:28px 0 12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.25em;color:${color};">${escapeHtml(title)}</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.25);">(${count})</span>
        <div style="flex:1;height:1px;background:rgba(255,255,255,0.06);"></div>
      </div>
    </td></tr>`;

  const emptyRow = (msg: string) => `
    <tr><td style="padding:10px 0;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.25);font-style:italic;">${msg}</p>
    </td></tr>`;

  // Section nouveaux membres
  const membresRows = newMembers.length
    ? newMembers.map((m) => `
      <tr>
        <td style="padding:7px 12px 7px 0;font-size:13px;color:rgba(255,255,255,0.8);">${escapeHtml(m.email)}</td>
        <td style="padding:7px 12px 7px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:${m.role === "admin" ? "#67e8f9" : m.role === "moderator" ? "#fcd34d" : "rgba(255,255,255,0.4)"};">${escapeHtml(m.role)}</td>
        <td style="padding:7px 0;font-size:11px;color:rgba(255,255,255,0.3);">${fmtDate(m.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucun nouveau membre inscrit.");

  // Section photos approuvées
  const approuveesRows = photoApprouvees.length
    ? photoApprouvees.map((a) => `
      <tr>
        <td style="padding:7px 0;font-size:13px;color:rgba(255,255,255,0.8);">${escapeHtml(a.description)}</td>
        <td style="padding:7px 0 7px 16px;font-size:11px;color:rgba(255,255,255,0.3);white-space:nowrap;">${fmtDate(a.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucune photo approuvée dans les dernières 24h.");

  // Section photos rejetées
  const rejeteesRows = photoRejetees.length
    ? photoRejetees.map((a) => `
      <tr>
        <td style="padding:7px 0;font-size:13px;color:rgba(255,255,255,0.8);">${escapeHtml(a.description)}</td>
        <td style="padding:7px 0 7px 16px;font-size:11px;color:rgba(255,255,255,0.3);white-space:nowrap;">${fmtDate(a.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucune photo rejetée dans les dernières 24h.");

  // Section photos en attente
  const pendingRowsHtml = pendingRows.length
    ? pendingRows.map((p) => `
      <tr>
        <td style="padding:7px 12px 7px 0;font-size:13px;color:rgba(255,255,255,0.8);">${escapeHtml(p.title)}</td>
        <td style="padding:7px 12px 7px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.4);">${escapeHtml(p.village)}</td>
        <td style="padding:7px 0;font-size:11px;color:rgba(255,255,255,0.3);white-space:nowrap;">${fmtDate(p.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucune photo en attente d'approbation.");

  // Section autres activités
  const autresRows = autresActivites.length
    ? autresActivites.map((a) => `
      <tr>
        <td style="padding:7px 12px 7px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.35);">${escapeHtml(a.type)}</td>
        <td style="padding:7px 12px 7px 0;font-size:13px;color:rgba(255,255,255,0.7);">${escapeHtml(a.description)}</td>
        <td style="padding:7px 0;font-size:11px;color:rgba(255,255,255,0.3);white-space:nowrap;">${fmtDate(a.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucune autre activité enregistrée.");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">

  <!-- En-tête -->
  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.4em;color:#67e8f9;">
    Plombières en Images
  </p>
  <h1 style="margin:0 0 4px;font-size:22px;font-weight:300;text-transform:uppercase;letter-spacing:0.12em;color:#ffffff;">
    Journal quotidien
  </h1>
  <p style="margin:0 0 32px;font-size:12px;color:rgba(255,255,255,0.3);text-transform:capitalize;">
    ${escapeHtml(today)}
  </p>

  <!-- Stats -->
  <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;margin-bottom:36px;">
    <tr>
      ${stat(newMembers.length, "Nouveaux membres", "#67e8f9")}
      ${stat(photoApprouvees.length, "Approuvées", "#34d399")}
      ${stat(photoRejetees.length, "Rejetées", "#f87171")}
      ${stat(pendingRows.length, "En attente", "#fcd34d")}
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;">

    <!-- Nouveaux membres -->
    ${sectionTitle("Nouveaux membres", newMembers.length)}
    <tr><td>
      <table style="width:100%;border-collapse:collapse;">${membresRows}</table>
    </td></tr>

    <!-- Photos approuvées -->
    ${sectionTitle("Photos approuvées", photoApprouvees.length, "#34d399")}
    <tr><td>
      <table style="width:100%;border-collapse:collapse;">${approuveesRows}</table>
    </td></tr>

    <!-- Photos rejetées -->
    ${sectionTitle("Photos rejetées", photoRejetees.length, "#f87171")}
    <tr><td>
      <table style="width:100%;border-collapse:collapse;">${rejeteesRows}</table>
    </td></tr>

    <!-- Photos en attente -->
    ${sectionTitle("Photos en attente d'approbation", pendingRows.length, "#fcd34d")}
    <tr><td>
      <table style="width:100%;border-collapse:collapse;">${pendingRowsHtml}</table>
    </td></tr>

    ${pendingRows.length > 0 ? `
    <tr><td style="padding:12px 0 0;">
      <a href="https://photoplombieres.eu/admin"
         style="display:inline-block;padding:10px 22px;background:rgba(103,232,249,0.1);border:1px solid rgba(103,232,249,0.35);color:#67e8f9;text-decoration:none;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;border-radius:20px;">
        Traiter les photos →
      </a>
    </td></tr>` : ""}

    <!-- Autres activités -->
    ${sectionTitle("Autres activités", autresActivites.length)}
    <tr><td>
      <table style="width:100%;border-collapse:collapse;">${autresRows}</table>
    </td></tr>

  </table>

  <!-- Pied de page -->
  <p style="margin:36px 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6;">
    Ce rapport est envoyé automatiquement chaque jour aux administrateurs de Plombières en Images.<br>
    <a href="https://photoplombieres.eu/admin" style="color:rgba(103,232,249,0.5);text-decoration:none;">Accéder à l&apos;administration</a>
  </p>

</div>
</body>
</html>`;
}
