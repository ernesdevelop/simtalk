import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-provider, x-user-api-key",
};

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    assertiveness_score: { type: "number", description: "Puntuación 0-100 de asertividad global" },
    overall_summary: { type: "string", description: "Resumen general (2-3 frases)" },
    strengths: { type: "array", items: { type: "string" }, description: "3-4 fortalezas" },
    improvements: { type: "array", items: { type: "string" }, description: "3-4 áreas de mejora" },
    tips: { type: "array", items: { type: "string" }, description: "4-5 consejos prácticos" },
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

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-20241022",
};

function extractJson(text: string): any {
  // Quita fences ```json ... ```
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  // Encuentra primer { y última }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const provider = (req.headers.get("x-user-provider") || "").toLowerCase();
    const userApiKey = req.headers.get("x-user-api-key") || "";
    if (!provider || !userApiKey) {
      return new Response(JSON.stringify({ error: "Falta tu API key. Configúrala en Ajustes." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    let feedback: any;

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${userApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: PROVIDER_DEFAULT_MODEL.openai,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ error: `OpenAI: ${t}` }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      feedback = extractJson(data.choices?.[0]?.message?.content || "{}");
    } else if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": userApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PROVIDER_DEFAULT_MODEL.anthropic,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ error: `Anthropic: ${t}` }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const text = (data.content || []).map((c: any) => c.text || "").join("");
      feedback = extractJson(text);
    } else if (provider === "gemini") {
      const model = PROVIDER_DEFAULT_MODEL.gemini;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ error: `Gemini: ${t}` }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
      feedback = extractJson(text);
    } else {
      return new Response(JSON.stringify({ error: `Proveedor no soportado: ${provider}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
