import { useCallback, useRef, useState } from "react";

const TRANSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`;

interface UseAudioRecorderOptions {
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}

export function useAudioRecorder({ onTranscript, onError }: UseAudioRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined";

  const start = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Safari prefiere mp4/aac; Chrome/Firefox webm/opus
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
        "",
      ];
      let mr: MediaRecorder | null = null;
      for (const m of mimeCandidates) {
        try {
          mr = m ? new MediaRecorder(stream, { mimeType: m }) : new MediaRecorder(stream);
          break;
        } catch {}
      }
      if (!mr) throw new Error("MediaRecorder no soportado");

      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const stream = streamRef.current;
        stream?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mr!.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 500) {
          onError?.("No detecté audio. Intenta nuevamente.");
          setTranscribing(false);
          return;
        }

        try {
          setTranscribing(true);
          const fd = new FormData();
          fd.append("audio", blob, "audio.webm");
          fd.append("language", "spa");
          const resp = await fetch(TRANSCRIBE_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: fd,
          });
          if (!resp.ok) {
            const err = await resp.text();
            console.error("transcribe failed", resp.status, err);
            onError?.("No pude transcribir el audio. Intenta nuevamente.");
            return;
          }
          const data = await resp.json();
          const text = (data?.text || "").trim();
          if (text) onTranscript(text);
          else onError?.("No detecté palabras claras. Intenta nuevamente.");
        } catch (err) {
          console.error(err);
          onError?.("Error al enviar el audio.");
        } finally {
          setTranscribing(false);
        }
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err: any) {
      console.error("getUserMedia error", err);
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        onError?.("Permiso de micrófono denegado. Revisa Ajustes > Safari > Micrófono.");
      } else {
        onError?.("No pude acceder al micrófono.");
      }
    }
  }, [recording, onTranscript, onError]);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try { mr.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  return { recording, transcribing, supported, start, stop };
}
