import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { sendEmail, statusUpdateHtml, statusUpdateSubject } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EMAIL_STATUSES = ["preparing", "ready_for_pickup", "shipping", "delivered"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Vérifier le JWT admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Valider le JWT via l'API auth
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Session invalide ou expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_id, status, note } = body;

    if (!order_id || !status) {
      return new Response(JSON.stringify({ error: "order_id et status requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    if (updateError) {
      console.error("update-order-status error:", updateError);
      return new Response(JSON.stringify({ error: "Erreur mise à jour" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insérer dans l'historique
    await supabase.from("order_status_history").insert({
      order_id,
      status,
      note: note || null,
      email_sent: false,
    });

    // Envoyer courriel au client si statut dans la liste
    if (EMAIL_STATUSES.includes(status)) {
      try {
        const html = statusUpdateHtml(order.order_number, status);
        const subject = statusUpdateSubject(order.order_number, status);
        if (html && subject) {
          await sendEmail(order.customer_email, subject, html);
          await supabase
            .from("order_status_history")
            .update({ email_sent: true })
            .eq("order_id", order_id)
            .eq("status", status)
            .order("created_at", { ascending: false })
            .limit(1);
        }
      } catch (emailErr) {
        console.error("Status email failed:", emailErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("update-order-status exception:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
