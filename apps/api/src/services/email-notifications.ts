import nodemailer from "nodemailer";

export interface LeadEmailPayload {
  name: string | null;
  phone: string;
  email: string | null;
  preferredTime: string | null;
  locale: string;
  questionSummary: string | null;
  conversationId: string | null;
  tenantName: string;
  notifyEmail: string;
}

function getTransporter() {
  const host = process.env.BREVO_SMTP_HOST ?? "smtp-relay.brevo.com";
  const port = parseInt(process.env.BREVO_SMTP_PORT ?? "587", 10);
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
}

function buildLeadHtml(p: LeadEmailPayload): string {
  const isFr = p.locale?.startsWith("fr");
  const lang = isFr ? "Français" : "English";
  const time = new Date().toLocaleString("fr-CA", {
    timeZone: "America/Montreal",
    dateStyle: "full",
    timeStyle: "short",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nouveau lead — ${p.tenantName}</title>
<style>
  body { margin:0; padding:0; background:#f4f6f9; font-family:Inter,Arial,sans-serif; }
  .wrapper { max-width:580px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:linear-gradient(135deg,#0d2a1a,#1a4a2e); padding:28px 32px; }
  .badge { display:inline-block; background:#c9a84c; color:#0d2a1a; font-weight:800; font-size:18px; padding:6px 14px; border-radius:6px; letter-spacing:0.06em; }
  .header h1 { color:#fff; margin:12px 0 0; font-size:20px; font-weight:700; }
  .body { padding:28px 32px; }
  .label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#888; margin-bottom:4px; }
  .value { font-size:16px; color:#111; font-weight:600; margin-bottom:20px; }
  .value.phone { font-size:22px; color:#0d6e3f; }
  .value.summary { font-size:14px; font-weight:400; color:#444; background:#f8f9fa; padding:12px 14px; border-radius:8px; border-left:3px solid #c9a84c; line-height:1.5; }
  .meta { background:#f8f9fa; border-radius:8px; padding:14px 16px; margin-top:20px; }
  .meta-row { display:flex; justify-content:space-between; font-size:12px; color:#666; margin-bottom:6px; }
  .meta-row:last-child { margin-bottom:0; }
  .footer { padding:16px 32px; background:#f0f4f0; text-align:center; font-size:11px; color:#999; }
  .cta { display:inline-block; background:#0d6e3f; color:#fff; text-decoration:none; padding:10px 22px; border-radius:8px; font-weight:700; font-size:14px; margin-top:20px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="badge">M</div>
    <h1>Nouveau lead — concierge IA</h1>
  </div>
  <div class="body">
    ${p.name ? `<div class="label">Prénom</div><div class="value">${p.name}</div>` : ""}
    <div class="label">Téléphone</div>
    <div class="value phone">📞 ${p.phone}</div>
    ${p.email ? `<div class="label">Courriel</div><div class="value">${p.email}</div>` : ""}
    ${p.preferredTime ? `<div class="label">Plage horaire souhaitée</div><div class="value">${p.preferredTime}</div>` : ""}
    ${p.questionSummary ? `<div class="label">Résumé de la conversation</div><div class="value summary">${p.questionSummary}</div>` : ""}
    <div class="meta">
      <div class="meta-row"><span>Date</span><span>${time}</span></div>
      <div class="meta-row"><span>Langue</span><span>${lang}</span></div>
      <div class="meta-row"><span>Conversation</span><span style="font-family:monospace;font-size:11px">${p.conversationId ?? "—"}</span></div>
    </div>
    <a href="mailto:${p.phone}" class="cta">Rappeler maintenant</a>
  </div>
  <div class="footer">${p.tenantName} — Concierge IA par MAA Platform</div>
</div>
</body>
</html>`;
}

export async function sendLeadNotificationEmail(p: LeadEmailPayload): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn("[email] BREVO_SMTP_USER or BREVO_SMTP_KEY not set — skipping lead email");
    return false;
  }

  const isFr = p.locale?.startsWith("fr");
  const nameStr = p.name ? ` — ${p.name}` : "";
  const subject = isFr
    ? `🔔 Nouveau lead${nameStr} (${p.phone}) — ${p.tenantName}`
    : `🔔 New lead${nameStr} (${p.phone}) — ${p.tenantName}`;

  try {
    await transporter.sendMail({
      from: `"${p.tenantName} Concierge IA" <${process.env.BREVO_SMTP_USER}>`,
      to: p.notifyEmail,
      subject,
      html: buildLeadHtml(p),
      text: [
        `Nouveau lead — ${p.tenantName}`,
        `Téléphone: ${p.phone}`,
        p.name ? `Nom: ${p.name}` : null,
        p.email ? `Courriel: ${p.email}` : null,
        p.preferredTime ? `Plage horaire: ${p.preferredTime}` : null,
        p.questionSummary ? `Résumé: ${p.questionSummary}` : null,
        `Conversation: ${p.conversationId ?? "—"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    console.info(`[email] Lead notification sent to ${p.notifyEmail} for ${p.phone}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send lead notification:", err);
    return false;
  }
}
