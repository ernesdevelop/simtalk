import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_PROVIDER_LABELS,
  loadUserKeys,
  saveUserKeys,
  type ChatProvider,
  type UserKeys,
} from "@/lib/userKeys";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PROVIDER_HELP: Record<ChatProvider, { url: string; placeholder: string; hint: string }> = {
  openai: {
    url: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
    hint: "Crea una key en platform.openai.com → API keys",
  },
  gemini: {
    url: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
    hint: "Crea una key gratis en Google AI Studio",
  },
  anthropic: {
    url: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    hint: "Crea una key en console.anthropic.com → API Keys",
  },
};

const SettingsDialog = ({ open, onOpenChange }: Props) => {
  const [keys, setKeys] = useState<UserKeys>(loadUserKeys);

  useEffect(() => {
    if (open) setKeys(loadUserKeys());
  }, [open]);

  const update = <K extends keyof UserKeys>(field: K, value: UserKeys[K]) => {
    setKeys((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveUserKeys(keys);
    toast.success("Configuración guardada");
    onOpenChange(false);
  };

  const help = PROVIDER_HELP[keys.provider];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuración de IA</DialogTitle>
          <DialogDescription className="flex items-start gap-2 pt-1">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              Tus API keys se guardan únicamente en este navegador. Nunca se envían a nuestros servidores ni se comparten.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Proveedor activo del chat</Label>
            <Select
              value={keys.provider}
              onValueChange={(v) => update("provider", v as ChatProvider)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CHAT_PROVIDER_LABELS) as ChatProvider[]).map((p) => (
                  <SelectItem key={p} value={p}>{CHAT_PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{help.hint}</p>
            <a
              href={help.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Obtener API key <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label htmlFor="key-openai">OpenAI API key</Label>
            <Input
              id="key-openai"
              type="password"
              autoComplete="off"
              placeholder="sk-..."
              value={keys.openai}
              onChange={(e) => update("openai", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="key-gemini">Google Gemini API key</Label>
            <Input
              id="key-gemini"
              type="password"
              autoComplete="off"
              placeholder="AIza..."
              value={keys.gemini}
              onChange={(e) => update("gemini", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="key-anthropic">Anthropic Claude API key</Label>
            <Input
              id="key-anthropic"
              type="password"
              autoComplete="off"
              placeholder="sk-ant-..."
              value={keys.anthropic}
              onChange={(e) => update("anthropic", e.target.value)}
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="key-eleven">ElevenLabs API key (opcional, para dictado IA)</Label>
            <Input
              id="key-eleven"
              type="password"
              autoComplete="off"
              placeholder="sk_..."
              value={keys.elevenlabs}
              onChange={(e) => update("elevenlabs", e.target.value)}
            />
            <a
              href="https://elevenlabs.io/app/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Obtener API key de ElevenLabs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
