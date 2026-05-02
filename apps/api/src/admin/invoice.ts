/**
 * Invoice generation and delivery for DUBUB onboarding.
 * Sends an HTML invoice via Brevo and creates a Stripe Checkout session.
 */

import Stripe from "stripe";

// ── Tax config ────────────────────────────────────────────────────────────────
// Quebec 2025 rates — update env vars if rates change
export const TAX = {
  gstRate: parseFloat(process.env.TAX_GST_RATE ?? "0.05"),        // 5%
  qstRate: parseFloat(process.env.TAX_QST_RATE ?? "0.09975"),     // 9.975%
  gstNumber: process.env.TAX_GST_NUMBER ?? "",                    // e.g. 123456789 RT0001
  qstNumber: process.env.TAX_QST_NUMBER ?? "",                    // e.g. 1234567890 TQ0001
  companyName: process.env.DUBUB_COMPANY_NAME ?? "DUBUB Inc.",
  companyAddress: process.env.DUBUB_ADDRESS ?? "Montréal, QC, Canada",
  companyEmail: process.env.DUBUB_EMAIL ?? "facturation@dubub.com",
  companyWebsite: process.env.DUBUB_WEBSITE ?? "https://dubub.com",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  qty: number;
  unitPrice: number; // CAD, before tax
}

export interface InvoiceParams {
  invoiceNumber: string;
  issueDate: string;        // ISO YYYY-MM-DD
  dueDate: string;          // ISO YYYY-MM-DD
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  lines: InvoiceLineItem[];
  notes?: string;
  billingTerm: "monthly" | "annual";
}

export interface InvoiceResult {
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  html: string;
}

// ── Invoice HTML builder ──────────────────────────────────────────────────────

export function buildInvoice(p: InvoiceParams): InvoiceResult {
  const subtotal = p.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const gst = round(subtotal * TAX.gstRate);
  const qst = round(subtotal * TAX.qstRate);
  const total = round(subtotal + gst + qst);
  const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });

  const rows = p.lines.map(l => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222">${l.description}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#666;text-align:center">${l.qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;text-align:right">${fmt(l.unitPrice)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:#111;text-align:right">${fmt(l.qty * l.unitPrice)}</td>
    </tr>`).join("");

  const taxRows = [
    TAX.gstNumber ? `<tr><td colspan="3" style="padding:6px 14px;text-align:right;font-size:13px;color:#666">TPS / GST (${(TAX.gstRate * 100).toFixed(0)}%) — N° ${TAX.gstNumber}</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#333">${fmt(gst)}</td></tr>` : `<tr><td colspan="3" style="padding:6px 14px;text-align:right;font-size:13px;color:#666">TPS / GST (${(TAX.gstRate * 100).toFixed(0)}%)</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#333">${fmt(gst)}</td></tr>`,
    TAX.qstNumber ? `<tr><td colspan="3" style="padding:6px 14px;text-align:right;font-size:13px;color:#666">TVQ / QST (${(TAX.qstRate * 100).toFixed(3)}%) — N° ${TAX.qstNumber}</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#333">${fmt(qst)}</td></tr>` : `<tr><td colspan="3" style="padding:6px 14px;text-align:right;font-size:13px;color:#666">TVQ / QST (${(TAX.qstRate * 100).toFixed(3)}%)</td><td style="padding:6px 14px;text-align:right;font-size:13px;color:#333">${fmt(qst)}</td></tr>`,
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Facture ${p.invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Inter,Arial,sans-serif">
<div style="max-width:680px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.1)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#111116,#1e1e2a);padding:36px 40px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="display:inline-block;background:#c9a84c;color:#111;font-weight:800;font-size:20px;padding:6px 14px;border-radius:6px;letter-spacing:0.06em">DUBUB</div>
      <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:10px">${TAX.companyAddress}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:3px">${TAX.companyEmail}</div>
      ${TAX.gstNumber ? `<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:8px">TPS/GST : ${TAX.gstNumber}</div>` : ""}
      ${TAX.qstNumber ? `<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px">TVQ/QST : ${TAX.qstNumber}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="color:#fff;font-size:28px;font-weight:800">FACTURE</div>
      <div style="color:#c9a84c;font-size:16px;font-weight:700;margin-top:4px">${p.invoiceNumber}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:12px">Émise le ${fmtDate(p.issueDate)}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:3px">Échéance ${fmtDate(p.dueDate)}</div>
    </div>
  </div>

  <!-- Bill to -->
  <div style="padding:28px 40px;border-bottom:1px solid #f0f0f0">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:8px">Facturer à</div>
    <div style="font-size:16px;font-weight:700;color:#111">${p.clientName}</div>
    ${p.clientAddress ? `<div style="font-size:13px;color:#666;margin-top:3px">${p.clientAddress}</div>` : ""}
    <div style="font-size:13px;color:#666;margin-top:3px">${p.clientEmail}</div>
  </div>

  <!-- Line items -->
  <div style="padding:28px 40px 0">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8f9fa">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999">Description</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999">Qté</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999">Prix unitaire</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr><td colspan="3" style="padding:10px 14px;text-align:right;font-size:13px;color:#666">Sous-total</td><td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#333">${fmt(subtotal)}</td></tr>
        ${taxRows}
        <tr style="background:#f8f9fb">
          <td colspan="3" style="padding:14px 14px;text-align:right;font-size:16px;font-weight:800;color:#111">Total CAD</td>
          <td style="padding:14px 14px;text-align:right;font-size:18px;font-weight:800;color:#c9a84c">${fmt(total)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${p.notes ? `
  <!-- Notes -->
  <div style="padding:24px 40px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:8px">Notes</div>
    <div style="font-size:13px;color:#555;line-height:1.6">${p.notes}</div>
  </div>` : ""}

  <!-- Footer -->
  <div style="padding:20px 40px;background:#f0f0f4;text-align:center">
    <div style="font-size:12px;color:#999">Merci de faire confiance à DUBUB · ${TAX.companyWebsite}</div>
    <div style="font-size:11px;color:#bbb;margin-top:4px">Les taxes applicables sont calculées selon les taux en vigueur au Québec, Canada.</div>
  </div>
</div>
</body>
</html>`;

  return { subtotal, gst, qst, total, html };
}

// ── Send invoice via Brevo ─────────────────────────────────────────────────────

export async function sendInvoiceEmail(params: InvoiceParams & { stripeUrl?: string }): Promise<void> {
  const { html, total } = buildInvoice(params);
  const apiKey = process.env.BREVO_API_KEY ?? process.env.BREVO_SMTP_KEY;
  if (!apiKey) return;

  const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  const stripeSection = params.stripeUrl
    ? `<div style="margin:24px 0;text-align:center"><a href="${params.stripeUrl}" style="display:inline-block;background:#c9a84c;color:#111;font-weight:800;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.04em">Payer en ligne — ${fmt(total)}</a><div style="font-size:11px;color:#999;margin-top:8px">Paiement sécurisé via Stripe</div></div>`
    : "";

  const body = html.replace("</body>", `${stripeSection}</body>`);

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: TAX.companyName, email: process.env.BREVO_SENDER_EMAIL ?? "facturation@dubub.com" },
      to: [{ email: params.clientEmail, name: params.clientName }],
      bcc: [{ email: process.env.DUBUB_INVOICE_BCC ?? "stevejes@gmail.com" }],
      subject: `Facture ${params.invoiceNumber} — ${TAX.companyName}`,
      htmlContent: body,
    }),
  });
}

// ── Create Stripe Checkout session ────────────────────────────────────────────

export async function createStripeCheckout(params: {
  clientEmail: string;
  clientName: string;
  invoiceNumber: string;
  lines: InvoiceLineItem[];
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  const stripe = new Stripe(secretKey);

  const lineItems = params.lines.map(l => ({
    price_data: {
      currency: "cad",
      unit_amount: Math.round(l.unitPrice * 100),
      product_data: { name: l.description },
    },
    quantity: l.qty,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.clientEmail,
    line_items: lineItems,
    automatic_tax: { enabled: true },
    metadata: { invoiceNumber: params.invoiceNumber, clientName: params.clientName },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session.url;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(n: number) { return Math.round(n * 100) / 100; }

export function nextInvoiceNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${yy}${mm}-${seq}`;
}
