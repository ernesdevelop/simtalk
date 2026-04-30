import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Scenario, Hostility } from "@/lib/scenarios";
import { hostilityLabels } from "@/lib/scenarios";
import { useDictation, useTTS, type VoiceGender } from "@/hooks/useSpeech";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import InstallVoiceDialog from "./InstallVoiceDialog";

type DictationMode = "native" | "ai";
const DICTATION_MODE_KEY = "dictation.mode";
const loadDictationMode = (): DictationMode => {
  if (typeof window === "undefined") return "native";
  const v = window.localStorage.getItem(DICTATION_MODE_KEY);
  return v === "ai" ? "ai" : "native";
};

export type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  scenario: Scenario;
  hostility: Hostility;
  onBack: () => void;
  onRequestFeedback: (messages: Msg[]) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const appendTranscript = (base: string, addition: string) => {
  const text = addition.trim();
  if (!text || base.trim().endsWith(text)) return base.trim();
  return `${base.trim()}${base.trim() ? " " : ""}${text}`;
};

const ChatView = ({ scenario, hostility, onBack, onRequestFeedback }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: scenario.opener },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tts = useTTS();
  const lastSpokenRef = useRef<string>("");
  const inputRef = useRef("");
  const voiceFinalRef = useRef("");
  const voiceInterimRef = useRef("");
  const autoSendRef = useRef(false);
  const [dictationMode, setDictationMode] = useState<DictationMode>(loadDictationMode);

  const dictation = useDictation({
    lang: "es-ES",
    onFinal: (t) => {
      voiceFinalRef.current = appendTranscript(voiceFinalRef.current, t);
      voiceInterimRef.current = "";
    },
    onInterim: (t) => {
      voiceInterimRef.current = t.trim();
    },
    onStop: () => {
      if (autoSendRef.current) {
        autoSendRef.current = false;
        const text = appendTranscript(voiceFinalRef.current, voiceInterimRef.current);
        voiceFinalRef.current = "";
        voiceInterimRef.current = "";
        if (text) {
          setTimeout(() => sendRef.current?.(text), 50);
        }
      }
    },
    onError: (error) => {
      autoSendRef.current = false;
      voiceFinalRef.current = "";
      voiceInterimRef.current = "";
      if (error === "not-allowed" || error === "service-not-allowed") {
        toast.error("Safari no tiene permiso para usar el micrófono. Revisa Ajustes > Safari > Micrófono.");
      } else if (error === "no-speech") {
        toast.error("No detecté voz. Toca el micrófono y habla después de aceptar el permiso.");
      } else {
        toast.error("No pude iniciar el dictado en este momento. Intenta tocar el micrófono otra vez.");
      }
    },
  });

  const recorder = useAudioRecorder({
    onTranscript: (text) => {
      sendRef.current?.(text);
    },
    onError: (msg) => toast.error(msg),
  });

  const changeDictationMode = (m: DictationMode) => {
    if (dictation.listening) dictation.stop();
    if (recorder.recording) recorder.stop();
    setDictationMode(m);
    try { window.localStorage.setItem(DICTATION_MODE_KEY, m); } catch {}
  };

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
    if (dictationMode === "ai") {
      if (!recorder.supported) {
        toast.error("Tu navegador no soporta grabación de audio.");
        return;
      }
      if (recorder.recording) {
        recorder.stop();
      } else {
        tts.cancel();
        recorder.start();
      }
      return;
    }

    // Modo nativo
    if (!dictation.supported) {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isIOSChromeOrFirefox = isIOS && /CriOS|FxiOS/i.test(ua);
      if (isIOSChromeOrFirefox) {
        toast.error("En iPhone, el dictado nativo solo funciona en Safari. Probá el modo IA o abrí la app desde Safari.");
      } else {
        toast.error("Tu navegador no soporta dictado nativo. Probá el modo IA.");
      }
      return;
    }
    if (dictation.listening) {
      autoSendRef.current = true;
      dictation.stop();
    } else {
      tts.cancel();
      autoSendRef.current = false;
      voiceFinalRef.current = "";
      voiceInterimRef.current = "";
      dictation.start();
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const sendRef = useRef<(overrideText?: string) => void>();

  const send = async (overrideText?: string) => {
    const text = ((overrideText ?? inputRef.current) || input).trim();
    if (!text || isStreaming) return;

    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    inputRef.current = "";
    setIsStreaming(true);

    try {
      const userKeys = loadUserKeys();
      const apiKey = getActiveChatKey(userKeys);
      if (!apiKey) {
        toast.error("Configurá tu API key en Ajustes para chatear.");
        setIsStreaming(false);
        // Revertir el mensaje optimista
        setMessages(messages);
        setInput(text);
        inputRef.current = text;
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "x-user-provider": userKeys.provider,
          "x-user-api-key": apiKey,
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
        toast.error("Tu API key se quedó sin crédito.");
        setIsStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        try {
          const err = await resp.clone().json();
          if (err?.error) toast.error(String(err.error).slice(0, 200));
        } catch {}
        throw new Error("stream failed");
      }

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

  sendRef.current = send;

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
                onClick={() => chooseGender("male")}
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-lg border border-border bg-card overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => changeDictationMode("native")}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  dictationMode === "native"
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Dictado nativo del navegador (rápido, gratis)"
              >
                Nativo
              </button>
              <button
                type="button"
                onClick={() => changeDictationMode("ai")}
                className={cn(
                  "px-2.5 py-1 border-l border-border transition-colors",
                  dictationMode === "ai"
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Transcripción con IA (más precisa)"
              >
                IA
              </button>
            </div>
            {dictationMode === "ai" && (
              <span className="text-[10px] text-muted-foreground">
                Mantené presionado al hablar y soltá para enviar
              </span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => {
                inputRef.current = e.target.value;
                setInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                recorder.recording
                  ? "Grabando…"
                  : recorder.transcribing
                  ? "Transcribiendo…"
                  : dictation.listening
                  ? "Escuchando…"
                  : "Escribe tu respuesta…"
              }
              rows={1}
              className="min-h-[48px] max-h-32 resize-none rounded-xl bg-card"
              disabled={isStreaming || dictation.listening || recorder.recording || recorder.transcribing}
            />
            <Button
              onClick={toggleMic}
              disabled={isStreaming || recorder.transcribing}
              size="icon"
              variant={dictation.listening || recorder.recording ? "default" : "outline"}
              className={cn(
                "h-12 w-12 shrink-0 rounded-xl",
                (dictation.listening || recorder.recording) &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
              )}
              title={
                recorder.transcribing
                  ? "Transcribiendo…"
                  : dictation.listening || recorder.recording
                  ? "Detener y enviar"
                  : "Dictar respuesta"
              }
            >
              {recorder.transcribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : dictation.listening || recorder.recording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              onClick={() => send()}
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

      <InstallVoiceDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        gender={requestedGender}
      />
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
