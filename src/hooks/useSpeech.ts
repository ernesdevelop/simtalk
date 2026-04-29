import { useCallback, useEffect, useRef, useState } from "react";

// ---------- Speech Recognition (dictado) ----------
type SR = any;

const getRecognition = (): SR | null => {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

export const isSpeechRecognitionSupported = () => {
  if (typeof window === "undefined") return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
};

interface UseDictationOptions {
  lang?: string;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
}

export function useDictation({ lang = "es-ES", onFinal, onInterim }: UseDictationOptions) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (listening) return;
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    let finalBuffer = "";

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) finalBuffer += transcript;
        else interim += transcript;
      }
      if (interim && onInterim) onInterim(interim);
      if (finalBuffer) {
        onFinal(finalBuffer);
        finalBuffer = "";
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, listening, onFinal, onInterim]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  return { listening, start, stop, supported: isSpeechRecognitionSupported() };
}

// ---------- Speech Synthesis (TTS nativo) ----------
export const isSpeechSynthesisSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

let cachedVoices: SpeechSynthesisVoice[] = [];
const loadVoices = () => {
  if (!isSpeechSynthesisSupported()) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
};
if (isSpeechSynthesisSupported()) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

const pickSpanishVoice = (): SpeechSynthesisVoice | undefined => {
  const voices = cachedVoices.length ? cachedVoices : loadVoices();
  return (
    voices.find((v) => /es-ES/i.test(v.lang) && /female|mujer|elena|monica|google/i.test(v.name)) ||
    voices.find((v) => /^es/i.test(v.lang)) ||
    voices[0]
  );
};

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text || !isSpeechSynthesisSupported()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickSpanishVoice();
      if (v) u.voice = v;
      u.lang = v?.lang || "es-ES";
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [enabled]
  );

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  return {
    speak,
    cancel,
    speaking,
    enabled,
    setEnabled,
    supported: isSpeechSynthesisSupported(),
  };
}
