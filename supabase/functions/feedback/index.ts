import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, scenarioTitle, scenarioContext, hostility } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const transcript = messages
      .map((m: any) => `${m.role === "user" ? "USUARIO" : "OTRA PERSONA"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Eres un coach experto en comunicación asertiva y conversaciones difíciles. Analizas la transcripción de un role-play y entregas feedback en español, claro, específico y útil. Devuelves SIEMPRE JSON válido a través de la herramienta proporcionada.`;

    const userPrompt = `ESCENARIO: ${scenarioTitle}
CONTEXTO: ${scenarioContext}
NIVEL DE HOSTILIDAD DE LA OTRA PERSONA: ${hostility}

TRANSCRIPCIÓN:
${transcript}

Analiza ÚNICAMENTE las intervenciones del USUARIO. Evalúa su asertividad (ni pasivo ni agresivo), claridad, escucha activa, manejo emocional y capacidad de mantener su posición bajo presión. Da consejos prácticos y un ejemplo concreto de cómo podría haber respondido mejor en un momento clave.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "give_feedback",
            description: "Entrega feedback estructurado sobre la asertividad del usuario.",
            parameters: {
              type: "object",
              properties: {
                assertiveness_score: { type: "number", description: "Puntuación 0-100 de asertividad global" },
                overall_summary: { type: "string", description: "Resumen general (2-3 frases)" },
                strengths: { type: "array", items: { type: "string" }, description: "3-4 fortalezas concretas observadas" },
                improvements: { type: "array", items: { type: "string" }, description: "3-4 áreas de mejora específicas" },
                tips: { type: "array", items: { type: "string" }, description: "4-5 consejos prácticos accionables" },
                rewrite_example: {
                  type: "object",
                  properties: {
                    original: { type: "string", description: "Una frase real del usuario que podría mejorarse" },
                    improved: { type: "string", description: "Versión más asertiva de esa frase" },
                    explanation: { type: "string", description: "Por qué la versión mejorada funciona mejor" },
                  },
                  required: ["original", "improved", "explanation"],
                  additionalProperties: false,
                },
              },
              required: ["assertiveness_score", "overall_summary", "strengths", "improvements", "tips", "rewrite_example"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "give_feedback" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Se requieren créditos en Lovable AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI feedback error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del modelo de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Respuesta del modelo sin tool call");
    const feedback = JSON.parse(toolCall.function.arguments);

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
