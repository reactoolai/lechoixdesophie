import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Nom, courriel et message sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3ECDF;font-family:Georgia,serif;color:#141416;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3ECDF;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFDF8;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#141416;padding:28px 40px;text-align:center;">
          <span style="font-family:'Jost',sans-serif;color:#C9A962;font-size:20px;font-weight:600;letter-spacing:.04em;">le choix de SOPHIE.</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:400;">Nouveau message — Formulaire de contact</h1>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr><td style="padding:4px 0;font-size:13px;color:#6B6B6B;width:80px;">De :</td><td style="padding:4px 0;font-size:14px;font-weight:600;">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#6B6B6B;">Sujet :</td><td style="padding:4px 0;font-size:14px;">${escapeHtml(subject || "Sans sujet")}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#F3ECDF;border-radius:6px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
          <p style="margin-top:20px;font-size:12px;color:#999;">Répondre directement à ${escapeHtml(email)}</p>
        </td></tr>
        <tr><td style="background:#141416;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#E8D9B8;">Propulsé par <a href="https://reactool.ai" style="color:#C9A962;text-decoration:none;">Reactool</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail(
      "info@lechoixdesophie.com",
      `Nouveau message de ${name} — ${subject || "Formulaire de contact"}`,
      html,
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
