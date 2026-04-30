import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-provider, x-user-api-key, x-user-model",
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

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-20241022",
};

// Convierte stream de Anthropic SSE a formato OpenAI SSE delta
function anthropicToOpenAIStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              const parsed = JSON.parse(json);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                const out = { choices: [{ delta: { content: parsed.delta.text } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`));
              } else if (parsed.type === "message_stop") {
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              }
            } catch {}
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

// Convierte stream de Gemini (JSON streaming via SSE alt=sse) a formato OpenAI
function geminiToOpenAIStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
              if (text) {
                const out = { choices: [{ delta: { content: text } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`));
              }
            } catch {}
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const provider = (req.headers.get("x-user-provider") || "").toLowerCase();
    const userApiKey = req.headers.get("x-user-api-key") || "";

    if (!provider || !userApiKey) {
      return new Response(
        JSON.stringify({ error: "Falta tu API key. Configúrala en Ajustes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages, scenarioTitle, scenarioContext, hostility } = await req.json();
    const systemPrompt = buildSystemPrompt(scenarioTitle, scenarioContext, hostility);

    let upstream: Response;

    if (provider === "openai") {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PROVIDER_DEFAULT_MODEL.openai,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return new Response(JSON.stringify({ error: `OpenAI: ${t}` }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(upstream.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    if (provider === "anthropic") {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": userApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PROVIDER_DEFAULT_MODEL.anthropic,
          system: systemPrompt,
          max_tokens: 1024,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text();
        return new Response(JSON.stringify({ error: `Anthropic: ${t}` }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(anthropicToOpenAIStream(upstream.body), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    if (provider === "gemini") {
      const model = PROVIDER_DEFAULT_MODEL.gemini;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${userApiKey}`;
      const contents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text();
        return new Response(JSON.stringify({ error: `Gemini: ${t}` }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(geminiToOpenAIStream(upstream.body), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: `Proveedor no soportado: ${provider}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
