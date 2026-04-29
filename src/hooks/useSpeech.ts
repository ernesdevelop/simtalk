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
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const setGender = useCallback((g: VoiceGender) => {
    setGenderState(g);
    try { window.localStorage.setItem(STORAGE_KEY, g); } catch {}
  }, []);

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
      const v = pickSpanishVoice(gender);
      if (v) u.voice = v;
      u.lang = v?.lang || "es-ES";
      u.rate = 1;
      // Si no encontramos voz del género solicitado, ajustamos pitch como fallback
      const matched = v ? guessGender(v) === gender : false;
      u.pitch = matched ? 1 : gender === "female" ? 1.25 : 0.8;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [enabled, gender]
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
    supported: isSpeechSynthesisSupported(),
  };
}

