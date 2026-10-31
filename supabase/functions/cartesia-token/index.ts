import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dailyglo.online",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  const apiKey = Deno.env.get("CARTESIA_API_KEY");
  if (!apiKey) return Response.json({ error: "Cartesia API key is not configured" }, { status: 503, headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const agentId = typeof body.agent_id === "string" && body.agent_id.length > 0 ? body.agent_id : Deno.env.get("CARTESIA_AGENT_ID");
  if (!agentId) return Response.json({ error: "Agent ID is not configured" }, { status: 500, headers: corsHeaders });

  const cartesiaResponse = await fetch("https://api.cartesia.ai/access-token", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Cartesia-Version": Deno.env.get("CARTESIA_VERSION") || "2026-08-14",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ grants: { agent: true }, expires_in: 300 })
  });
  const result = await cartesiaResponse.json().catch(() => ({}));
  if (!cartesiaResponse.ok) {
    console.error("Cartesia token request failed", cartesiaResponse.status);
    return Response.json({ error: "Cartesia token request failed" }, { status: 502, headers: corsHeaders });
  }
  return Response.json({ access_token: result.access_token, agent_id: agentId, expires_in: result.expires_in || 300 }, { headers: corsHeaders });
});
