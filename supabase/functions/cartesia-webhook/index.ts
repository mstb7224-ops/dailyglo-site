import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dailyglo.online",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const answers: Record<string, string> = {
  registration: "Open https://dailyglo.online/pages/register.html and complete the secure registration form.",
  iqama_upload: "Upload a JPG, PNG, or WebP Iqama image up to 5 MB through the secure DailyGlo website form.",
  login: "Use https://dailyglo.online/pages/login.html with your registered email and password. Never share the password by voice.",
  payment_help: "Log in first, then use the secure payment form. Never share a bKash PIN, bank PIN, OTP, or card number by voice."
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  const expected = Deno.env.get("DAILYGLO_CARTESIA_WEBHOOK_SECRET");
  const authorization = req.headers.get("authorization") || "";
  if (!expected || authorization !== `Bearer ${expected}`) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic : "";
  return Response.json({ ok: true, message: answers[topic] || "Please use the secure DailyGlo website for registration help." }, { headers: corsHeaders });
});
