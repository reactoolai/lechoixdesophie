import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cart_token, items, subtotal, email, first_name, last_name, phone, reached_checkout } = body;

    if (!cart_token) {
      return new Response(JSON.stringify({ error: "cart_token requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const itemsArray = Array.isArray(items) ? items : [];
    const itemsCount = itemsArray.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);

    const update: Record<string, any> = {
      items: itemsArray,
      items_count: itemsCount,
      subtotal: parseFloat(subtotal) || 0,
      last_seen_at: new Date().toISOString(),
    };

    if (email) update.email = email;
    if (first_name) update.first_name = first_name;
    if (last_name) update.last_name = last_name;
    if (phone) update.phone = phone;
    if (reached_checkout !== undefined) update.reached_checkout = reached_checkout;

    const { error } = await supabase
      .from("abandoned_carts")
      .upsert({ cart_token, ...update }, { onConflict: "cart_token" });

    if (error) {
      console.error("track-cart error:", error);
      return new Response(JSON.stringify({ error: "Erreur base de données" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-cart exception:", err);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
