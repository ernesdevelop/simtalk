// Configuración BYOK (bring-your-own-key) guardada solo en localStorage del usuario.
// Las keys nunca se guardan en el servidor.

export type ChatProvider = "openai" | "gemini" | "anthropic";

export const CHAT_PROVIDER_LABELS: Record<ChatProvider, string> = {
  openai: "OpenAI (GPT)",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
};

export interface UserKeys {
  provider: ChatProvider;
  openai: string;
  gemini: string;
  anthropic: string;
  elevenlabs: string;
}

const STORAGE_KEY = "user.aiKeys.v1";

const empty: UserKeys = {
  provider: "openai",
  openai: "",
  gemini: "",
  anthropic: "",
  elevenlabs: "",
};

export const loadUserKeys = (): UserKeys => {
  if (typeof window === "undefined") return { ...empty };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw);
    return {
      provider:
        parsed.provider === "gemini" || parsed.provider === "anthropic"
          ? parsed.provider
          : "openai",
      openai: typeof parsed.openai === "string" ? parsed.openai : "",
      gemini: typeof parsed.gemini === "string" ? parsed.gemini : "",
      anthropic: typeof parsed.anthropic === "string" ? parsed.anthropic : "",
      elevenlabs: typeof parsed.elevenlabs === "string" ? parsed.elevenlabs : "",
    };
  } catch {
    return { ...empty };
  }
};

export const saveUserKeys = (keys: UserKeys) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    window.dispatchEvent(new CustomEvent("user-keys-changed"));
  } catch {}
};

export const getActiveChatKey = (keys: UserKeys): string => {
  return keys[keys.provider]?.trim() || "";
};

export const hasChatKey = (keys: UserKeys): boolean => !!getActiveChatKey(keys);
export const hasSttKey = (keys: UserKeys): boolean => !!keys.elevenlabs.trim();
