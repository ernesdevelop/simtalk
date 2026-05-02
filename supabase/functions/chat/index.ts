import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOSTILITY_DESCRIPTIONS: Record<string, string> = {
  low: "Estás algo reticente pero abierto/a. Escuchas, pero pones objeciones suaves y haces preguntas escépticas.",
  medium: "Estás claramente molesto/a o defensivo/a. Interrumpes, cuestionas con dureza, pones excusas y muestras frustración.",
  high: "Estás muy hostil: a la defensiva, sarcástico/a, con tono cortante. Atacas, minimizas y rechazas con dureza. Nunca insultes con palabrotas, pero sé duro/a emocionalmente.",
};

function buildSystemPrompt(scenarioTitle: string, scenarioContext: string, hostility: string) {
  return `Estás haciendo un role-play en español para que el usuario practique una conversación difícil.

ESCENARIO: ${scenarioTitle}
CONTEXTO: ${scenarioContext}

TU ROL: Eres la "otra persona" en esta conversación, NO el coach. Mantén el personaje en todo momento.
NIVEL DE HOSTILIDAD: ${hostility.toUpperCase()} — ${HOSTILITY_DESCRIPTIONS[hostility] || HOSTILITY_DESCRIPTIONS.medium}

REGLAS:
- Responde SIEMPRE en primera persona como el personaje.
- Mensajes cortos y realistas (1-3 frases normalmente).
- Reacciona emocionalmente a lo que diga el usuario: si es asertivo, puedes ablandarte gradualmente; si es agresivo o pasivo, intensifica tu postura.
- Nunca rompas el personaje, nunca des consejos, nunca digas que eres una IA.
- No uses emojis ni markdown. Solo texto natural de conversación.
- Comienza tú la conversación si es el primer mensaje.`;
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
    const systemPrompt = buildSystemPrompt(scenarioTitle, scenarioContext, hostility);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      return new Response(JSON.stringify({ error: t }), {
        status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
