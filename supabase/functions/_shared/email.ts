// Shared email module — Resend API + HTML templates for Le Choix de Sophie

const RESEND_URL = "https://api.resend.com/emails";

const COLORS = {
  noir: "#141416",
  or: "#C9A962",
  orClair: "#E8D9B8",
  ivoire: "#F3ECDF",
  blanc: "#FFFFFF",
  gris: "#6B6B6B",
  grisClair: "#999999",
};

export interface OrderItem {
  name: string;
  image_url?: string | null;
  color?: string | null;
  size?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderInfo {
  order_number: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone?: string | null;
  fulfillment_type: string;
  ship_address1?: string | null;
  ship_address2?: string | null;
  ship_city?: string | null;
  ship_province?: string | null;
  ship_postal_code?: string | null;
  ship_country?: string | null;
  customer_note?: string | null;
  subtotal: number;
  shipping_total: number;
  tps: number;
  tvq: number;
  total: number;
  items: OrderItem[];
}

function fmt(n: number): string {
  return (n / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

function shopUrl(): string {
  return Deno.env.get("SHOP_URL") || "https://lechoixdesophie.com";
}

function logoUrl(): string {
  return shopUrl() + "/assets/lockup-sombre.png";
}

function adminUrl(): string {
  return shopUrl() + "/#/admin";
}

function baseHtml(inner: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.ivoire};font-family:Georgia,'Times New Roman',serif;color:${COLORS.noir};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.ivoire};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${COLORS.blanc};border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:${COLORS.noir};padding:28px 40px;text-align:center;">
          <img src="${logoUrl()}" alt="Le Choix de Sophie" style="height:48px;max-width:240px;" />
        </td></tr>
        <tr><td style="padding:36px 40px 24px;">
          ${inner}
        </td></tr>
        <tr><td style="background:${COLORS.noir};padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${COLORS.orClair};letter-spacing:0.05em;">
            Propulsé par <a href="https://reactool.ai" style="color:${COLORS.or};text-decoration:none;">Reactool</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function itemsTable(items: OrderItem[]): string {
  const rows = items.map((it) => {
    const img = it.image_url
      ? `<img src="${it.image_url}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid ${COLORS.ivoire};"/>`
      : `<div style="width:60px;height:60px;background:${COLORS.ivoire};border-radius:4px;"></div>`;
    const colorSize = [it.color, it.size].filter(Boolean).join(" / ");
    return `<tr>
      <td style="padding:8px 0;vertical-align:top;width:64px;">${img}</td>
      <td style="padding:8px 12px;vertical-align:top;">
        <div style="font-size:14px;font-weight:600;color:${COLORS.noir};">${escapeHtml(it.name)}</div>
        ${colorSize ? `<div style="font-size:12px;color:${COLORS.gris};margin-top:2px;">${escapeHtml(colorSize)}</div>` : ""}
      </td>
      <td style="padding:8px 12px;vertical-align:top;text-align:center;font-size:13px;color:${COLORS.gris};">${it.quantity}</td>
      <td style="padding:8px 0;vertical-align:top;text-align:right;font-size:14px;color:${COLORS.noir};white-space:nowrap;">${fmt(it.line_total)}</td>
    </tr>`;
  }).join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr style="border-bottom:1px solid ${COLORS.ivoire};">
      <th style="padding:8px 0;text-align:left;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.grisClair};font-weight:500;"></th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.grisClair};font-weight:500;">Article</th>
      <th style="padding:8px 12px;text-align:center;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.grisClair};font-weight:500;">Qté</th>
      <th style="padding:8px 0;text-align:right;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.grisClair};font-weight:500;">Prix</th>
    </tr>
    ${rows}
  </table>`;
}

function totalsTable(o: OrderInfo): string {
  const fulfillmentLine = o.fulfillment_type === "pickup"
    ? "Ramassage en boutique — 630 Rue Sacré-Coeur O, Alma"
    : [o.ship_address1, o.ship_address2, o.ship_city, o.ship_province, o.ship_postal_code].filter(Boolean).join(", ");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
    <tr><td style="padding:6px 0;font-size:13px;color:${COLORS.gris};">Sous-total</td><td style="padding:6px 0;text-align:right;font-size:13px;color:${COLORS.noir};">${fmt(o.subtotal)}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:${COLORS.gris};">Livraison</td><td style="padding:6px 0;text-align:right;font-size:13px;color:${COLORS.noir};">${o.shipping_total === 0 ? "Gratuite" : fmt(o.shipping_total)}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:${COLORS.gris};">TPS (5%)</td><td style="padding:6px 0;text-align:right;font-size:13px;color:${COLORS.noir};">${fmt(o.tps)}</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:${COLORS.gris};">TVQ (9,975%)</td><td style="padding:6px 0;text-align:right;font-size:13px;color:${COLORS.noir};">${fmt(o.tvq)}</td></tr>
    <tr style="border-top:2px solid ${COLORS.or};"><td style="padding:12px 0;font-size:16px;font-weight:700;color:${COLORS.noir};">Total</td><td style="padding:12px 0;text-align:right;font-size:16px;font-weight:700;color:${COLORS.noir};">${fmt(o.total)}</td></tr>
  </table>
  <div style="margin-top:16px;padding:12px 16px;background:${COLORS.ivoire};border-radius:6px;">
    <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.grisClair};margin-bottom:4px;">Mode de réception</div>
    <div style="font-size:14px;color:${COLORS.noir};">${escapeHtml(fulfillmentLine)}</div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function contactBlock(o: OrderInfo): string {
  const lines = [
    `${o.customer_first_name} ${o.customer_last_name}`,
    o.customer_email,
  ];
  if (o.customer_phone) lines.push(o.customer_phone);
  if (o.fulfillment_type === "delivery") {
    const addr = [o.ship_address1, o.ship_address2, o.ship_city, o.ship_province, o.ship_postal_code].filter(Boolean).join(", ");
    if (addr) lines.push(addr);
  }
  if (o.customer_note) lines.push(`Note: ${o.customer_note}`);
  return `<div style="margin-top:16px;padding:12px 16px;background:${COLORS.ivoire};border-radius:6px;">
    <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.grisClair};margin-bottom:6px;">Coordonnées du client</div>
    ${lines.map((l) => `<div style="font-size:13px;color:${COLORS.noir};margin-bottom:2px;">${escapeHtml(l)}</div>`).join("")}
  </div>`;
}

// --- Public template builders ---

export function orderConfirmationHtml(o: OrderInfo): string {
  const inner = `
    <h1 style="margin:0 0 8px;font-size:26px;color:${COLORS.noir};font-weight:400;">Merci pour votre commande !</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${COLORS.gris};">Nous avons bien reçu votre commande <strong style="color:${COLORS.or};">${o.order_number}</strong>. Voici le récapitulatif :</p>
    ${itemsTable(o.items)}
    ${totalsTable(o)}
    <p style="margin-top:24px;font-size:13px;color:${COLORS.gris};">Pour toute question, écrivez-nous à <a href="mailto:info@lechoixdesophie.com" style="color:${COLORS.or};text-decoration:none;">info@lechoixdesophie.com</a>.</p>`;
  return baseHtml(inner);
}

export function orderNotificationHtml(o: OrderInfo): string {
  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${COLORS.noir};font-weight:400;">Nouvelle commande</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${COLORS.gris};">Commande <strong style="color:${COLORS.or};">${o.order_number}</strong></p>
    ${itemsTable(o.items)}
    ${totalsTable(o)}
    ${contactBlock(o)}
    <a href="${adminUrl()}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:${COLORS.or};color:${COLORS.noir};text-decoration:none;border-radius:4px;font-size:14px;font-weight:600;">Voir dans l'admin</a>`;
  return baseHtml(inner);
}

export function statusUpdateHtml(orderNumber: string, status: string): string {
  const messages: Record<string, { subject: string; body: string }> = {
    preparing: {
      subject: `Votre commande ${orderNumber} est en préparation`,
      body: `<p style="font-size:14px;color:${COLORS.gris};">Votre commande <strong style="color:${COLORS.or};">${orderNumber}</strong> est maintenant en préparation. Nous vous aviserons dès qu'elle sera prête.</p>`,
    },
    ready_for_pickup: {
      subject: `Votre commande ${orderNumber} est prête pour le ramassage`,
      body: `<p style="font-size:14px;color:${COLORS.gris};">Votre commande <strong style="color:${COLORS.or};">${orderNumber}</strong> est prête ! Vous pouvez venir la chercher à la boutique :</p>
        <div style="margin:16px 0;padding:12px 16px;background:${COLORS.ivoire};border-radius:6px;">
          <div style="font-size:14px;color:${COLORS.noir};font-weight:600;">Le Choix de Sophie</div>
          <div style="font-size:13px;color:${COLORS.gris};">630 Rue Sacré-Coeur O, Alma, QC</div>
          <div style="font-size:13px;color:${COLORS.gris};margin-top:4px;">Du lundi au samedi, 10h — 17h</div>
        </div>`,
    },
    shipping: {
      subject: `Votre commande ${orderNumber} est en livraison`,
      body: `<p style="font-size:14px;color:${COLORS.gris};">Votre commande <strong style="color:${COLORS.or};">${orderNumber}</strong> est en route vers vous ! Vous devriez la recevoir sous peu.</p>`,
    },
    delivered: {
      subject: `Votre commande ${orderNumber} a été livrée`,
      body: `<p style="font-size:14px;color:${COLORS.gris};">Votre commande <strong style="color:${COLORS.or};">${orderNumber}</strong> a été livrée. J'espère que vous en êtes satisfaite !</p>
        <p style="font-size:14px;color:${COLORS.gris};">Pour tout commentaire, écrivez-moi à <a href="mailto:info@lechoixdesophie.com" style="color:${COLORS.or};text-decoration:none;">info@lechoixdesophie.com</a>.</p>`,
    },
  };
  const msg = messages[status];
  if (!msg) return "";
  const inner = `
    <h1 style="margin:0 0 16px;font-size:24px;color:${COLORS.noir};font-weight:400;">${escapeHtml(msg.subject)}</h1>
    ${msg.body}`;
  return baseHtml(inner);
}

export function statusUpdateSubject(orderNumber: string, status: string): string {
  const subjects: Record<string, string> = {
    preparing: `Votre commande ${orderNumber} est en préparation`,
    ready_for_pickup: `Votre commande ${orderNumber} est prête pour le ramassage`,
    shipping: `Votre commande ${orderNumber} est en livraison`,
    delivered: `Votre commande ${orderNumber} a été livrée`,
  };
  return subjects[status] || `Mise à jour de votre commande ${orderNumber}`;
}

export async function sendEmail(to: string | string[], subject: string, html: string, replyTo?: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured");
    return;
  }
  const recipients = Array.isArray(to) ? to : [to];
  const body: Record<string, unknown> = {
    from: "Le Choix de Sophie <info@lechoixdesophie.com>",
    reply_to: replyTo || "info@lechoixdesophie.com",
    to: recipients,
    subject,
    html,
  };
  try {
    const resp = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`Resend error ${resp.status}: ${text}`);
    }
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

export function orderConfirmationSubject(orderNumber: string): string {
  return `Confirmation de votre commande ${orderNumber}`;
}

export function orderNotificationSubject(orderNumber: string): string {
  return `Nouvelle commande ${orderNumber} — Le Choix de Sophie`;
}
