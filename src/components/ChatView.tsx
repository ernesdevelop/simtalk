import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Scenario, Hostility } from "@/lib/scenarios";
import { hostilityLabels } from "@/lib/scenarios";
import { useDictation, useTTS, type VoiceGender } from "@/hooks/useSpeech";
import InstallVoiceDialog from "./InstallVoiceDialog";

export type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  scenario: Scenario;
  hostility: Hostility;
  onBack: () => void;
  onRequestFeedback: (messages: Msg[]) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatView = ({ scenario, hostility, onBack, onRequestFeedback }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: scenario.opener },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tts = useTTS();
  const lastSpokenRef = useRef<string>("");
  const dictation = useDictation({
    lang: "es-ES",
    onFinal: (t) => setInput((prev) => (prev ? prev.trimEnd() + " " : "") + t.trim()),
  });

  // Habla el primer mensaje al montar
  useEffect(() => {
    if (tts.enabled && tts.supported && scenario.opener) {
      lastSpokenRef.current = scenario.opener;
      tts.speak(scenario.opener);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Habla la última respuesta del asistente cuando termina el streaming
  useEffect(() => {
    if (isStreaming) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (last.content === lastSpokenRef.current) return;
    lastSpokenRef.current = last.content;
    if (tts.enabled) tts.speak(last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, messages]);

  const toggleVoice = () => {
    if (tts.speaking) tts.cancel();
    tts.setEnabled(!tts.enabled);
  };

  const toggleMic = () => {
    if (!dictation.supported) {
      toast.error("Tu navegador no soporta dictado por voz. Prueba Chrome o Edge.");
      return;
    }
    if (dictation.listening) dictation.stop();
    else {
      tts.cancel(); // evita captar la voz de la IA
      dictation.start();
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsStreaming(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next,
          scenarioTitle: scenario.title,
          scenarioContext: scenario.context,
          hostility,
        }),
      });

      if (resp.status === 429) {
        toast.error("Demasiadas solicitudes, espera un momento.");
        setIsStreaming(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("Se requieren créditos en tu workspace de Lovable AI.");
        setIsStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let added = false;
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantSoFar += delta;
              setMessages((prev) => {
                if (!added) {
                  added = true;
                  return [...prev, { role: "assistant", content: assistantSoFar }];
                }
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
                );
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Hubo un problema con la conversación.");
    } finally {
      setIsStreaming(false);
    }
  };

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const canFeedback = userMsgCount >= 2 && !isStreaming;
  const meta = hostilityLabels[hostility];

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [requestedGender, setRequestedGender] = useState<VoiceGender>(tts.gender);

  const chooseGender = (g: VoiceGender) => {
    tts.cancel();
    tts.setGender(g);
    if (tts.supported && !tts.hasVoiceFor(g)) {
      setRequestedGender(g);
      setInstallDialogOpen(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{scenario.title}</div>
            <div className="text-xs text-muted-foreground">
              Hostilidad: <span className={meta.color}>{meta.label}</span>
            </div>
          </div>
          {tts.supported && (
            <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVoice}
                className="h-9 w-9 rounded-none"
                title={tts.enabled ? "Silenciar voz de la IA" : "Activar voz de la IA"}
              >
                {tts.enabled ? (
                  <Volume2 className={cn("h-4 w-4", tts.speaking && "text-primary animate-pulse")} />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <button
                type="button"
                onClick={() => chooseGender("female")}
                title="Voz femenina"
                className={cn(
                  "h-9 px-2 text-xs font-medium border-l border-border transition-colors",
                  tts.gender === "female"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                ♀
              </button>
              <button
                type="button"
                onClick={() => { tts.cancel(); tts.setGender("male"); }}
                title="Voz masculina"
                className={cn(
                  "h-9 px-2 text-xs font-medium border-l border-border transition-colors",
                  tts.gender === "male"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                ♂
              </button>
            </div>
          )}
          <Button
            onClick={() => onRequestFeedback(messages)}
            disabled={!canFeedback}
            className="gradient-primary text-primary-foreground hover:opacity-95"
            size="sm"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Ver Feedback
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {isStreaming && messages[messages.length - 1]?.role === "user" && (
            <MessageBubble role="assistant" content="…" pulse />
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Escribe tu respuesta…"
              rows={1}
              className="min-h-[48px] max-h-32 resize-none rounded-xl bg-card"
              disabled={isStreaming}
            />
            <Button
              onClick={toggleMic}
              disabled={isStreaming}
              size="icon"
              variant={dictation.listening ? "default" : "outline"}
              className={cn(
                "h-12 w-12 shrink-0 rounded-xl",
                dictation.listening && "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
              )}
              title={dictation.listening ? "Detener dictado" : "Dictar respuesta"}
            >
              {dictation.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button
              onClick={send}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-12 w-12 shrink-0 gradient-primary text-primary-foreground hover:opacity-95"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          {!canFeedback && userMsgCount < 2 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Envía al menos 2 mensajes para poder pedir feedback.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ role, content, pulse }: { role: "user" | "assistant"; content: string; pulse?: boolean }) => {
  const isUser = role === "user";
  return (
    <div className={cn("flex animate-in-up", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-card",
          isUser
            ? "gradient-primary text-primary-foreground rounded-br-sm"
            : "bg-card text-card-foreground rounded-bl-sm border border-border",
          pulse && "animate-pulse-soft"
        )}
      >
        {content}
      </div>
    </div>
  );
};

export default ChatView;
