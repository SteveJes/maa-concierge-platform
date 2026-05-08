export interface LeadEmailPayload {
  name: string | null;
  phone: string;
  email: string | null;
  preferredTime: string | null;
  locale: string;
  questionSummary: string | null;
  conversationId: string | null;
  tenantName: string;
  /**
   * Where to send the lead. Supports a single email or a comma/semicolon-separated
   * list ("steve@dubub.com,daphne@dubub.com"). All addresses are sent in one Brevo call.
   */
  notifyEmail: string;
}

/**
 * Split a notifyEmail string into a Brevo `to` array.
 * Accepts comma OR semicolon as separators. Trims whitespace, drops empty/invalid entries.
 */
function parseRecipients(notifyEmail: string): Array<{ email: string }> {
  return notifyEmail
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"))
    .map((email) => ({ email }));
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
  .header { background:linear-gradient(135deg,#111116,#1e1e2a); padding:28px 32px; }
  .badge { display:inline-block; background:#c9a84c; color:#111116; font-weight:800; font-size:18px; padding:6px 14px; border-radius:6px; letter-spacing:0.06em; }
  .header h1 { color:#fff; margin:12px 0 0; font-size:20px; font-weight:700; }
  .body { padding:28px 32px; }
  .label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#888; margin-bottom:4px; }
  .value { font-size:16px; color:#111; font-weight:600; margin-bottom:20px; }
  .value.phone { font-size:22px; color:#2a2a38; }
  .value.summary { font-size:14px; font-weight:400; color:#444; background:#f8f9fa; padding:12px 14px; border-radius:8px; border-left:3px solid #c9a84c; line-height:1.5; }
  .meta { background:#f8f9fa; border-radius:8px; padding:14px 16px; margin-top:20px; }
  .meta-row { display:flex; justify-content:space-between; font-size:12px; color:#666; margin-bottom:6px; }
  .meta-row:last-child { margin-bottom:0; }
  .footer { padding:16px 32px; background:#f0f0f4; text-align:center; font-size:11px; color:#999; }
  .cta { display:inline-block; background:#2a2a38; color:#fff; text-decoration:none; padding:10px 22px; border-radius:8px; font-weight:700; font-size:14px; margin-top:20px; }
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
    <a href="tel:${p.phone}" class="cta">Rappeler maintenant</a>
  </div>
  <div class="footer">${p.tenantName} — Concierge IA par MAA Platform</div>
</div>
</body>
</html>`;
}

export async function sendLeadNotificationEmail(p: LeadEmailPayload): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY ?? process.env.BREVO_SMTP_KEY;

  if (!apiKey) {
    console.warn("[email] No Brevo API key found — skipping lead email");
    return false;
  }

  const isFr = p.locale?.startsWith("fr");
  const nameStr = p.name ? ` — ${p.name}` : "";
  const subject = isFr
    ? `🔔 Nouveau lead${nameStr} (${p.phone}) — ${p.tenantName}`
    : `🔔 New lead${nameStr} (${p.phone}) — ${p.tenantName}`;

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@dubub.com";
  const senderName = `${p.tenantName} Concierge IA`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: parseRecipients(p.notifyEmail),
        subject,
        htmlContent: buildLeadHtml(p),
        textContent: [
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
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[email] Brevo API error ${response.status}: ${body}`);
      return false;
    }

    console.info(`[email] Lead notification sent to ${p.notifyEmail} for ${p.phone}`);
    return true;
  } catch (err) {
    console.error("[email] Failed to send lead notification:", err);
    return false;
  }
}
