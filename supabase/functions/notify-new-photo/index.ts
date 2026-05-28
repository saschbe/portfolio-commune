import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

interface Photo {
  id: string;
  title: string;
  village: string;
  year: string;
  type: string;
  description: string;
  src: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const photo: Photo = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Récupérer les admins/modérateurs avec notif_new_photo = true
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "moderator"])
      .eq("notif_new_photo", true);

    if (profilesError) {
      throw new Error(`Erreur profiles : ${profilesError.message}`);
    }

    if (!profiles?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Aucun destinataire trouvé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Récupérer les adresses email via auth.admin
    const recipients: { id: string; email: string }[] = [];
    for (const profile of profiles) {
      const {
        data: { user },
      } = await supabase.auth.admin.getUserById(profile.id);
      if (user?.email) {
        recipients.push({ id: profile.id, email: user.email });
      }
    }

    if (!recipients.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Aucune adresse email trouvée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Envoi des emails via SMTP Hostinger
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: "contact@photoplombieres.eu",
        pass: Deno.env.get("SMTP_PASSWORD")!,
      },
    });

    const html = buildEmailHtml(photo);

    for (const recipient of recipients) {
      await transporter.sendMail({
        from: '"Plombières en Images" <contact@photoplombieres.eu>',
        to: recipient.email,
        subject: `Nouvelle photo en attente — ${photo.title}`,
        html,
      });
    }

    // 4. Enregistrer l'activité
    await supabase.from("activites").insert({
      type: "notification_envoyee",
      description: `Notification envoyée à ${recipients.length} destinataire(s) pour la photo "${photo.title}"`,
      meta: {
        photo_id: photo.id,
        photo_title: photo.title,
        recipients_count: recipients.length,
        recipient_ids: recipients.map((r) => r.id),
      },
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ sent: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notify-new-photo]", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildEmailHtml(photo: Photo): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">

    <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.35em;color:#67e8f9;">
      Plombières en Images
    </p>
    <h1 style="margin:0 0 28px;font-size:20px;font-weight:300;text-transform:uppercase;letter-spacing:0.15em;color:#ffffff;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:24px;">
      Nouvelle photo en attente
    </h1>

    <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.35);width:100px;vertical-align:top;">Titre</td>
        <td style="padding:8px 0;font-size:14px;color:#ffffff;">${escapeHtml(photo.title)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.35);vertical-align:top;">Village</td>
        <td style="padding:8px 0;font-size:14px;color:#ffffff;">${escapeHtml(photo.village)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.35);vertical-align:top;">Année</td>
        <td style="padding:8px 0;font-size:14px;color:#ffffff;">${escapeHtml(photo.year)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.35);vertical-align:top;">Type</td>
        <td style="padding:8px 0;font-size:14px;color:#ffffff;">${escapeHtml(photo.type)}</td>
      </tr>
      ${
        photo.description
          ? `<tr>
        <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.35);vertical-align:top;">Description</td>
        <td style="padding:8px 0;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;">${escapeHtml(photo.description)}</td>
      </tr>`
          : ""
      }
    </table>

    <a href="https://photoplombieres.eu/admin"
       style="display:inline-block;padding:12px 28px;background:rgba(103,232,249,0.1);border:1px solid rgba(103,232,249,0.35);color:#67e8f9;text-decoration:none;font-size:11px;text-transform:uppercase;letter-spacing:0.25em;border-radius:24px;">
      Voir dans l&apos;administration
    </a>

    <p style="margin:32px 0 0;font-size:11px;color:rgba(255,255,255,0.2);border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;line-height:1.6;">
      Vous recevez cet email car vous avez activé les notifications pour les nouvelles photos sur Plombières en Images.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
