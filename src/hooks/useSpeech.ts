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
  const listeningRef = useRef(false);

  // Refs estables para los callbacks (evita recrear `start` y perder el gesto en iOS)
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const stop = useCallback(() => {
    listeningRef.current = false;
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  // IMPORTANTE: `start` debe ser estable (sin deps que cambien) para que iOS Safari
  // mantenga el contexto del gesto del usuario al invocar rec.start() sincrónicamente.
  const start = useCallback(() => {
    if (listeningRef.current) return;

    const rec = getRecognition();
    if (!rec) return;

    rec.lang = lang;
    // iOS Safari NO soporta continuous=true correctamente. Usar false.
    rec.continuous = !isIOS;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalBuffer = "";

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) finalBuffer += transcript;
        else interim += transcript;
      }
      if (interim) onInterimRef.current?.(interim);
      if (finalBuffer) {
        onFinalRef.current?.(finalBuffer);
        finalBuffer = "";
      }
    };
    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
    };
    rec.onerror = (e: any) => {
      console.warn("[dictation] error:", e?.error || e);
      listeningRef.current = false;
      setListening(false);
    };

    recRef.current = rec;
    // Llamada síncrona — crítico para iOS
    try {
      rec.start();
      listeningRef.current = true;
      setListening(true);
    } catch (err) {
      console.warn("[dictation] start failed:", err);
      listeningRef.current = false;
      setListening(false);
    }
  }, [lang, isIOS]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  return { listening, start, stop, supported: isSpeechRecognitionSupported() };
}

// ---------- Speech Synthesis (TTS nativo) ----------
export type VoiceGender = "female" | "male";

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

// Heurística por nombre — Web Speech API no expone género
const FEMALE_HINTS = /(female|mujer|woman|elena|monica|mónica|paulina|lucia|lucía|marisol|esperanza|sabina|helena|carmen|laura|sofia|sofía|isabel|google.*español.*(?!hombre)|samantha|victoria|zira)/i;
const MALE_HINTS = /(male|hombre|man|jorge|diego|enrique|carlos|juan|pablo|miguel|alex|luca|paul|daniel|reed)/i;

const guessGender = (v: SpeechSynthesisVoice): VoiceGender | null => {
  const n = v.name;
  if (FEMALE_HINTS.test(n)) return "female";
  if (MALE_HINTS.test(n)) return "male";
  return null;
};

const pickSpanishVoice = (gender: VoiceGender): SpeechSynthesisVoice | undefined => {
  const voices = cachedVoices.length ? cachedVoices : loadVoices();
  const spanish = voices.filter((v) => /^es/i.test(v.lang));
  if (spanish.length === 0) return voices[0];

  // 1) Coincidencia por género en español
  const matched = spanish.find((v) => guessGender(v) === gender);
  if (matched) return matched;

  // 2) Si pidió masculino y no hay match, evita las claramente femeninas
  if (gender === "male") {
    const notFemale = spanish.find((v) => guessGender(v) !== "female");
    if (notFemale) return notFemale;
  } else {
    const notMale = spanish.find((v) => guessGender(v) !== "male");
    if (notMale) return notMale;
  }

  return spanish[0];
};

const STORAGE_KEY = "tts.voiceGender";
const loadGender = (): VoiceGender => {
  if (typeof window === "undefined") return "female";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "male" || v === "female" ? v : "female";
};

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [gender, setGenderState] = useState<VoiceGender>(loadGender);
  const [voicesVersion, setVoicesVersion] = useState(0);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Recarga cuando el SO añade/quita voces (ej. usuario instala una nueva)
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    const handler = () => {
      loadVoices();
      setVoicesVersion((v) => v + 1);
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
  }, []);

  const setGender = useCallback((g: VoiceGender) => {
    setGenderState(g);
    try { window.localStorage.setItem(STORAGE_KEY, g); } catch {}
  }, []);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const hasVoiceFor = useCallback(
    (g: VoiceGender) => {
      void voicesVersion; // recompute when voices change
      const voices = cachedVoices.length ? cachedVoices : loadVoices();
      return voices.some((v) => /^es/i.test(v.lang) && guessGender(v) === g);
    },
    [voicesVersion]
  );

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text || !isSpeechSynthesisSupported()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickSpanishVoice(gender);
      if (v) u.voice = v;
      u.lang = v?.lang || "es-ES";
      u.rate = 1;
      const matched = v ? guessGender(v) === gender : false;
      u.pitch = matched ? 1 : gender === "female" ? 1.25 : 0.8;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [enabled, gender, voicesVersion]
  );

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  return {
    speak,
    cancel,
    speaking,
    enabled,
    setEnabled,
    gender,
    setGender,
    hasVoiceFor,
    supported: isSpeechSynthesisSupported(),
  };
}

// ---------- Detección de SO para guiar la instalación ----------
export type OS = "windows" | "macos" | "ios" | "android" | "linux" | "unknown";

export const detectOS = (): OS => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Mac OS X/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
};


