import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveCustomScenario } from "@/lib/customScenarios";
import type { Scenario } from "@/lib/scenarios";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (s: Scenario) => void;
}

const empty = { title: "", shortDescription: "", context: "", opener: "" };

const CustomScenarioDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [form, setForm] = useState(empty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim(),
      context: form.context.trim(),
      opener: form.opener.trim(),
    };
    if (!trimmed.title || !trimmed.context || !trimmed.opener) {
      toast.error("Completa título, contexto y primer mensaje.");
      return;
    }
    if (!trimmed.shortDescription) trimmed.shortDescription = trimmed.title;
    const created = saveCustomScenario(trimmed);
    toast.success("Escenario guardado");
    setForm(empty);
    onCreated(created);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setForm(empty); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crear escenario personalizado
          </DialogTitle>
          <DialogDescription>
            Describe la situación y el papel que debe interpretar la IA.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ej. Hablar con una mujer que recién conozco"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descripción corta (opcional)</Label>
            <Input
              id="desc"
              placeholder="Ej. Una conversación en una cafetería"
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context">Contexto y papel de la IA</Label>
            <Textarea
              id="context"
              rows={4}
              placeholder="Ej. El usuario está en una cafetería y se acerca a alguien que le interesa. Tú eres esa persona: amable pero precavida, no sabes si quieres conversar y tienes prisa."
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              maxLength={600}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Cuanto más claro definas el papel de la IA, más realista será.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opener">Primer mensaje de la otra persona</Label>
            <Textarea
              id="opener"
              rows={2}
              placeholder="Ej. ¿Sí…? ¿Necesitas algo?"
              value={form.opener}
              onChange={(e) => setForm({ ...form, opener: e.target.value })}
              maxLength={300}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary text-primary-foreground hover:opacity-95">
              Crear escenario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomScenarioDialog;
