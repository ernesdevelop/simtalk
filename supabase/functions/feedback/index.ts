import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    assertiveness_score: { type: "number" },
    overall_summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    tips: { type: "array", items: { type: "string" } },
    rewrite_example: {
      type: "object",
      properties: {
        original: { type: "string" },
        improved: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["original", "improved", "explanation"],
    },
  },
  required: ["assertiveness_score", "overall_summary", "strengths", "improvements", "tips", "rewrite_example"],
};

function extractJson(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, scenarioTitle, scenarioContext, hostility } = await req.json();

    const transcript = messages
      .map((m: any) => `${m.role === "user" ? "USUARIO" : "OTRA PERSONA"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Eres un coach experto en comunicación asertiva y conversaciones difíciles. Analizas la transcripción de un role-play y entregas feedback en español, claro, específico y útil. Devuelves SIEMPRE JSON válido siguiendo el esquema dado, sin texto adicional.`;

    const userPrompt = `ESCENARIO: ${scenarioTitle}
CONTEXTO: ${scenarioContext}
NIVEL DE HOSTILIDAD DE LA OTRA PERSONA: ${hostility}

TRANSCRIPCIÓN:
${transcript}

Analiza ÚNICAMENTE las intervenciones del USUARIO. Evalúa su asertividad (ni pasivo ni agresivo), claridad, escucha activa, manejo emocional y capacidad de mantener su posición bajo presión. Da consejos prácticos y un ejemplo concreto de cómo podría haber respondido mejor en un momento clave.

Devuelve SOLO un objeto JSON con este esquema (sin markdown, sin fences):
${JSON.stringify(FEEDBACK_SCHEMA)}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: t }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const feedback = extractJson(data.choices?.[0]?.message?.content || "{}");

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("feedback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
