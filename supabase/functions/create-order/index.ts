import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  sendEmail,
  orderConfirmationHtml,
  orderConfirmationSubject,
  orderNotificationHtml,
  orderNotificationSubject,
  type OrderInfo,
  type OrderItem,
} from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function squareErrorToFrench(err: any): string {
  const code = err?.errors?.[0]?.code || err?.code || "";
  const detail = err?.errors?.[0]?.detail || "";
  if (code === "CARD_DECLINED") return "Carte refusée. Vérifiez le numéro ou essayez une autre carte.";
  if (code === "INVALID_CARD_DATA") return "Les informations de la carte sont invalides. Vérifiez et réessayez.";
  if (code === "EXPIRED_CARD") return "La carte est expirée. Utilisez une autre carte.";
  if (code === "INSUFFICIENT_FUNDS") return "Fonds insuffisants sur la carte.";
  if (code === "CARD_INSUFFICIENT_FUNDS") return "Fonds insuffisants sur la carte.";
  if (code === "PROCESSING_ERROR") return "Erreur de traitement. Veuillez réessayer dans un instant.";
  if (detail) return detail;
  return "Le paiement a échoué. Vérifiez vos informations ou essayez une autre carte.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      cart_token,
      customer,
      fulfillment_type,
      shipping,
      note,
      items: clientItems,
      payment_token,
    } = body;

    // 1. Validation
    if (!customer?.first_name || !customer?.last_name) {
      return jsonError(400, "Le prénom et le nom sont obligatoires.");
    }
    if (!isValidEmail(customer?.email || "")) {
      return jsonError(400, "Adresse courriel invalide.");
    }
    if (!Array.isArray(clientItems) || clientItems.length === 0) {
      return jsonError(400, "Le panier est vide.");
    }
    if (!payment_token) {
      return jsonError(400, "Token de paiement manquant.");
    }
    const ftype = fulfillment_type === "pickup" ? "pickup" : "delivery";
    if (ftype === "delivery") {
      if (!shipping?.address1 || !shipping?.city || !shipping?.postal_code) {
        return jsonError(400, "Adresse, ville et code postal obligatoires pour la livraison.");
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 2. Recalculer les prix côté serveur
    const numrefs = clientItems.map((it: any) => it.numref).filter(Boolean);
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("numref, description, price, images")
      .in("numref", numrefs);

    if (prodError || !products) {
      return jsonError(500, "Erreur lors de la lecture des produits.");
    }

    const productMap = new Map<string, any>();
    products.forEach((p: any) => productMap.set(p.numref, p));

    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    for (const ci of clientItems) {
      const product = productMap.get(ci.numref);
      if (!product) continue;
      const qty = parseInt(ci.quantity) || 1;
      const unitPrice = parseFloat(product.price) || 0;
      const lineTotal = round2(unitPrice * qty);
      subtotal = round2(subtotal + lineTotal);
      const coverImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
      const imageUrl = coverImage
        ? (coverImage.startsWith("http")
            ? coverImage
            : `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/product-photos/products/${coverImage}`)
        : null;
      orderItems.push({
        name: product.description || ci.numref,
        image_url: imageUrl,
        color: ci.color || null,
        size: ci.size || null,
        quantity: qty,
        unit_price: unitPrice * 100,
        line_total: lineTotal * 100,
      });
    }

    if (orderItems.length === 0) {
      return jsonError(400, "Aucun produit valide dans le panier.");
    }

    // 3. Totaux
    const shippingTotal = ftype === "pickup" ? 0 : subtotal >= 200 ? 0 : 25.0;
    const tps = round2((subtotal + shippingTotal) * 0.05);
    const tvq = round2((subtotal + shippingTotal) * 0.09975);
    const total = round2(subtotal + shippingTotal + tps + tvq);
    const totalCents = Math.round(total * 100);

    // 4. Générer numéro de commande + créer en base
    const { data: orderNumberData, error: orderNumError } = await supabase.rpc("next_order_number");
    if (orderNumError || !orderNumberData) {
      return jsonError(500, "Erreur génération numéro de commande.");
    }
    const orderNumber = orderNumberData;

    const { data: orderRow, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        status: "pending_payment",
        customer_first_name: customer.first_name,
        customer_last_name: customer.last_name,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        fulfillment_type: ftype,
        ship_address1: shipping?.address1 || null,
        ship_address2: shipping?.address2 || null,
        ship_city: shipping?.city || null,
        ship_province: shipping?.province || "QC",
        ship_postal_code: shipping?.postal_code || null,
        ship_country: "CA",
        customer_note: note || null,
        subtotal: subtotal,
        shipping_total: shippingTotal,
        tps: tps,
        tvq: tvq,
        total: total,
        currency: "CAD",
        payment_provider: "square",
        payment_status: "pending",
        cart_token: cart_token || null,
      })
      .select()
      .single();

    if (orderError || !orderRow) {
      console.error("create-order insert error:", orderError);
      return jsonError(500, "Erreur création commande.");
    }

    const orderId = orderRow.id;

    // Insert order_items
    const itemRows = orderItems.map((it) => ({
      order_id: orderId,
      product_numref: clientItems.find((ci: any) => productMap.get(ci.numref)?.description === it.name)?.numref || "",
      name: it.name,
      image_url: it.image_url,
      color: it.color,
      size: it.size,
      unit_price: it.unit_price / 100,
      quantity: it.quantity,
      line_total: it.line_total / 100,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) console.error("order_items insert error:", itemsError);

    // 5. Encaisser avec Square
    const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const squareLocation = Deno.env.get("SQUARE_LOCATION_ID");

    if (!squareToken || !squareLocation) {
      await supabase.from("orders").update({ status: "cancelled", payment_status: "failed" }).eq("id", orderId);
      return jsonError(500, "Configuration de paiement manquante.");
    }

    const idempotencyKey = crypto.randomUUID();

    let squareResp: Response;
    try {
      squareResp = await fetch("https://connect.squareup.com/v2/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${squareToken}`,
          "Square-Version": "2025-01-23",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          source_id: payment_token,
          amount_money: { amount: totalCents, currency: "CAD" },
          location_id: squareLocation,
          reference_id: orderNumber,
          buyer_email_address: customer.email,
          note: `Commande ${orderNumber} — Le Choix de Sophie`,
        }),
      });
    } catch (fetchErr) {
      console.error("Square fetch error:", fetchErr);
      await supabase.from("orders").update({ status: "cancelled", payment_status: "failed" }).eq("id", orderId);
      return jsonError(502, "Impossible de joindre le service de paiement. Réessayez dans un instant.");
    }

    const squareData = await squareResp.json();

    if (!squareResp.ok) {
      console.error("Square payment error:", JSON.stringify(squareData));
      await supabase.from("orders").update({ status: "cancelled", payment_status: "failed" }).eq("id", orderId);
      const frenchMsg = squareErrorToFrench(squareData);
      return jsonError(402, frenchMsg);
    }

    const squarePaymentId = squareData?.payment?.id || null;

    // Succès → mettre à jour la commande
    await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_status: "paid",
        square_payment_id: squarePaymentId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // 6. Marquer le panier converti
    if (cart_token) {
      await supabase
        .from("abandoned_carts")
        .update({ status: "converted", converted_order_id: orderId })
        .eq("cart_token", cart_token);
    }

    // 8. Insérer dans order_status_history
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      status: "paid",
      note: "Paiement confirmé",
      email_sent: false,
    });

    // 7. Envoyer les courriels (ne jamais faire échouer la commande)
    const orderInfo: OrderInfo = {
      order_number: orderNumber,
      customer_first_name: customer.first_name,
      customer_last_name: customer.last_name,
      customer_email: customer.email,
      customer_phone: customer.phone || null,
      fulfillment_type: ftype,
      ship_address1: shipping?.address1 || null,
      ship_address2: shipping?.address2 || null,
      ship_city: shipping?.city || null,
      ship_province: shipping?.province || "QC",
      ship_postal_code: shipping?.postal_code || null,
      ship_country: "CA",
      customer_note: note || null,
      subtotal: subtotal * 100,
      shipping_total: shippingTotal * 100,
      tps: tps * 100,
      tvq: tvq * 100,
      total: total * 100,
      items: orderItems,
    };

    try {
      await sendEmail(
        customer.email,
        orderConfirmationSubject(orderNumber),
        orderConfirmationHtml(orderInfo),
      );
    } catch (e) {
      console.error("Customer email failed:", e);
    }

    const notifyEmail = Deno.env.get("ORDER_NOTIFY_EMAIL");
    if (notifyEmail) {
      try {
        await sendEmail(
          notifyEmail,
          orderNotificationSubject(orderNumber),
          orderNotificationHtml(orderInfo),
        );
      } catch (e) {
        console.error("Admin email failed:", e);
      }
    }

    // 9. Réponse
    return new Response(JSON.stringify({ ok: true, order_number: orderNumber, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-order exception:", err);
    return jsonError(500, "Erreur serveur lors de la création de la commande.");
  }
});

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
