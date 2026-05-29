import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// -- Types --------------------------------------------------------------------

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

// -- CORS ---------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// -- Handler -------------------------------------------------------------------

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

// -- Helpers -------------------------------------------------------------------

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

// -- HTML email ----------------------------------------------------------------

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

  const S = {
    text:    "font-size:13px;color:#111111;",
    meta:    "font-size:11px;color:#999999;white-space:nowrap;",
    empty:   "font-size:12px;color:#bbbbbb;font-style:italic;margin:0;",
    sep:     "border-top:1px solid #e8e8e8;",
    tdR:     "padding:7px 16px 7px 0;",
    tdDate:  "padding:7px 0;",
  };

  const sectionTitle = (title: string) => `
    <tr><td style="padding:24px 0 8px;">
      <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;color:#111111;">${escapeHtml(title)}</p>
      <div style="height:1px;background:#e8e8e8;margin-top:6px;"></div>
    </td></tr>`;

  const emptyRow = (msg: string) => `
    <tr><td style="padding:6px 0 2px;"><p style="${S.empty}">${msg}</p></td></tr>`;

  const row2 = (a: string, b: string) => `
    <tr>
      <td style="${S.tdR}${S.text}">${a}</td>
      <td style="${S.tdDate}${S.meta}">${b}</td>
    </tr>`;

  const membresRows = newMembers.length
    ? newMembers.map((m) => `
      <tr>
        <td style="${S.tdR}${S.text}">${escapeHtml(m.email)}</td>
        <td style="padding:7px 16px 7px 0;font-size:11px;color:#999999;">${escapeHtml(m.role)}</td>
        <td style="${S.tdDate}${S.meta}">${fmtDate(m.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucun nouveau membre inscrit.");

  const approuveesRows = photoApprouvees.length
    ? photoApprouvees.map((a) => row2(escapeHtml(a.description), fmtDate(a.created_at))).join("")
    : emptyRow("Aucune photo approuvée dans les dernières 24h.");

  const rejeteesRows = photoRejetees.length
    ? photoRejetees.map((a) => row2(escapeHtml(a.description), fmtDate(a.created_at))).join("")
    : emptyRow("Aucune photo rejetée dans les dernières 24h.");

  const pendingRowsHtml = pendingRows.length
    ? pendingRows.map((p) => `
      <tr>
        <td style="${S.tdR}${S.text}">${escapeHtml(p.title)}</td>
        <td style="padding:7px 16px 7px 0;font-size:11px;color:#999999;">${escapeHtml(p.village)}</td>
        <td style="${S.tdDate}${S.meta}">${fmtDate(p.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucune photo en attente d'approbation.");

  const autresRows = autresActivites.length
    ? autresActivites.map((a) => `
      <tr>
        <td style="padding:7px 16px 7px 0;font-size:11px;color:#999999;">${escapeHtml(a.type)}</td>
        <td style="${S.tdR}${S.text}">${escapeHtml(a.description)}</td>
        <td style="${S.tdDate}${S.meta}">${fmtDate(a.created_at)}</td>
      </tr>`).join("")
    : emptyRow("Aucune autre activité enregistrée.");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:36px 24px 48px;">

  <!-- En-tête -->
  <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.35em;color:#666666;">Plombières en Images</p>
  <h1 style="margin:0 0 4px;font-size:22px;font-weight:400;color:#111111;letter-spacing:-0.01em;">Journal quotidien</h1>
  <p style="margin:0 0 28px;font-size:12px;color:#999999;">${escapeHtml(today)}</p>
  <div style="height:1px;background:#e8e8e8;margin-bottom:28px;"></div>

  <!-- Stats -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="width:25%;text-align:center;padding:0 0 24px;">
        <div style="font-size:32px;font-weight:700;color:#111111;line-height:1;">${newMembers.length}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#666666;margin-top:5px;">Membres</div>
      </td>
      <td style="width:25%;text-align:center;padding:0 0 24px;border-left:1px solid #e8e8e8;">
        <div style="font-size:32px;font-weight:700;color:#111111;line-height:1;">${photoApprouvees.length}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#666666;margin-top:5px;">Approuvées</div>
      </td>
      <td style="width:25%;text-align:center;padding:0 0 24px;border-left:1px solid #e8e8e8;">
        <div style="font-size:32px;font-weight:700;color:#111111;line-height:1;">${photoRejetees.length}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#666666;margin-top:5px;">Rejetées</div>
      </td>
      <td style="width:25%;text-align:center;padding:0 0 24px;border-left:1px solid #e8e8e8;">
        <div style="font-size:32px;font-weight:700;color:#111111;line-height:1;">${pendingRows.length}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#666666;margin-top:5px;">En attente</div>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:#e8e8e8;margin-bottom:4px;"></div>

  <!-- Sections -->
  <table style="width:100%;border-collapse:collapse;">

    ${sectionTitle("Nouveaux membres")}
    <tr><td><table style="width:100%;border-collapse:collapse;">${membresRows}</table></td></tr>

    ${sectionTitle("Photos approuvées")}
    <tr><td><table style="width:100%;border-collapse:collapse;">${approuveesRows}</table></td></tr>

    ${sectionTitle("Photos rejetées")}
    <tr><td><table style="width:100%;border-collapse:collapse;">${rejeteesRows}</table></td></tr>

    ${sectionTitle("Photos en attente d'approbation")}
    <tr><td><table style="width:100%;border-collapse:collapse;">${pendingRowsHtml}</table></td></tr>

    ${pendingRows.length > 0 ? `
    <tr><td style="padding:10px 0 0;">
      <a href="https://photoplombieres.eu/admin"
         style="display:inline-block;padding:9px 18px;background:#111111;color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:0.1em;">
        Traiter les photos &rarr;
      </a>
    </td></tr>` : ""}

    ${sectionTitle("Autres activités")}
    <tr><td><table style="width:100%;border-collapse:collapse;">${autresRows}</table></td></tr>

  </table>

  <!-- Pied de page -->
  <div style="height:1px;background:#e8e8e8;margin:32px 0 20px;"></div>
  <p style="margin:0;font-size:11px;color:#bbbbbb;line-height:1.7;">
    Rapport automatique &mdash; Plombières en Images &mdash;
    <a href="https://photoplombieres.eu/admin" style="color:#111111;text-decoration:underline;">Administration</a>
  </p>

</div>
</body>
</html>`;
}
