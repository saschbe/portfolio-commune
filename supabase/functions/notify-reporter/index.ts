import nodemailer from "npm:nodemailer";

const RAISONS: Record<string, string> = {
  personne_non_consentante: "Personne non consentante",
  informations_incorrectes: "Informations incorrectes",
  photo_non_conforme: "Photo non conforme",
  violation_droits_auteur: "Violation de droits d'auteur",
  autre: "Autre",
};

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
    const { email, photoTitle, raison } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ skipped: true, message: "Aucune adresse email fournie" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!photoTitle || !raison) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants : photoTitle et raison sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: "contact@photoplombieres.eu",
        pass: Deno.env.get("SMTP_PASSWORD")!,
      },
    });

    const html = buildEmailHtml(email, photoTitle, raison);

    await transporter.sendMail({
      from: '"Plombières en Images" <contact@photoplombieres.eu>',
      to: email,
      subject: `Votre signalement a bien été reçu — Plombières en Images`,
      html,
    });

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notify-reporter]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEmailHtml(email: string, photoTitle: string, raison: string): string {
  const raisonLabel = RAISONS[raison] ?? raison;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signalement reçu</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px;">

    <!-- Carte principale -->
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">

      <!-- En-tête cyan -->
      <div style="background:#22d3ee;padding:32px 36px 28px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.35em;color:rgba(0,0,0,0.5);">
          Plombières en Images
        </p>
        <h1 style="margin:0;font-size:22px;font-weight:300;text-transform:uppercase;letter-spacing:0.15em;color:#000000;line-height:1.3;">
          Signalement<br>reçu
        </h1>
      </div>

      <!-- Corps -->
      <div style="padding:36px 36px 32px;">

        <p style="margin:0 0 24px;font-size:15px;color:#111111;line-height:1.7;">
          Bonjour,
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#111111;line-height:1.7;">
          Nous avons bien reçu votre signalement concernant la photo
          <strong style="color:#000000;">&laquo;&nbsp;${escapeHtml(photoTitle)}&nbsp;&raquo;</strong>
          pour la raison suivante&nbsp;: <span style="color:#0891b2;font-weight:600;">${escapeHtml(raisonLabel)}</span>.
        </p>

        <!-- Encadré info -->
        <div style="margin:0 0 28px;padding:20px 24px;background:#f0fdfe;border-left:3px solid #22d3ee;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#0891b2;font-weight:600;">
            Mesure immédiate
          </p>
          <p style="margin:0;font-size:14px;color:#1e4a52;line-height:1.6;">
            La photo a été <strong>provisoirement retirée</strong> de la galerie publique dans l'attente de l'examen de votre signalement par notre équipe.
          </p>
        </div>

        <p style="margin:0 0 28px;font-size:14px;color:#444444;line-height:1.7;">
          Notre équipe de modération va examiner votre demande dans les plus brefs délais. Si des informations complémentaires nous sont nécessaires, nous vous contacterons à cette adresse email.
        </p>

        <!-- Séparateur -->
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 28px;">

        <!-- Récapitulatif -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
          <tr>
            <td style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#9ca3af;width:110px;vertical-align:top;">Photo</td>
            <td style="padding:6px 0;font-size:13px;color:#111111;">${escapeHtml(photoTitle)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#9ca3af;vertical-align:top;">Motif</td>
            <td style="padding:6px 0;font-size:13px;color:#111111;">${escapeHtml(raisonLabel)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#9ca3af;vertical-align:top;">Signalé par</td>
            <td style="padding:6px 0;font-size:13px;color:#111111;">${escapeHtml(email)}</td>
          </tr>
        </table>

        <!-- CTA -->
        <a href="https://www.photoplombieres.eu/mentions-legales"
           style="display:inline-block;padding:13px 28px;background:#22d3ee;color:#000000;text-decoration:none;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.25em;border-radius:24px;">
          Mentions légales
        </a>

      </div>

      <!-- Pied de page -->
      <div style="padding:20px 36px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
          Vous recevez cet email car vous avez soumis un signalement sur
          <a href="https://www.photoplombieres.eu" style="color:#0891b2;text-decoration:none;">photoplombieres.eu</a>.
          Pour toute question, contactez-nous à
          <a href="mailto:contact@photoplombieres.eu" style="color:#0891b2;text-decoration:none;">contact@photoplombieres.eu</a>.
        </p>
      </div>

    </div>
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
