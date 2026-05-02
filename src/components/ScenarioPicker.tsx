import { useState } from "react";
import { scenarios, hostilityLabels, type Scenario, type Hostility } from "@/lib/scenarios";
import { useCustomScenarios, deleteCustomScenario } from "@/lib/customScenarios";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CustomScenarioDialog from "./CustomScenarioDialog";

interface Props {
  onStart: (scenario: Scenario, hostility: Hostility) => void;
}

const ScenarioPicker = ({ onStart }: Props) => {
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [hostility, setHostility] = useState<Hostility>("medium");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { items: customScenarios, refresh } = useCustomScenarios();

  const handleStartClick = () => {
    if (selected) onStart(selected, hostility);
  };

  const allScenarios = [...customScenarios, ...scenarios];

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteCustomScenario(id);
    if (selected?.id === id) setSelected(null);
    refresh();
  };

  return (
    <div className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 text-center animate-in-up">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Entrenamiento con IA
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Practica conversaciones <span className="text-gradient">difíciles</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Elige un escenario, conversa con la IA en el papel de la otra persona y recibe feedback sobre tu asertividad.
          </p>
        </header>

        <section className="mb-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Elige un escenario
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <Plus className="mr-1 h-4 w-4" />
              Crear escenario
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setDialogOpen(true)}
              className="group flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/30 p-5 text-center transition-all hover:border-primary/60 hover:bg-card/60 animate-in-up"
            >
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-primary transition-colors group-hover:border-primary/50">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold">Nuevo escenario</div>
              <div className="text-xs text-muted-foreground">Personalízalo a tu situación</div>
            </button>

            {allScenarios.map((s, i) => {
              const Icon = s.icon;
              const isSelected = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    "group relative flex flex-col items-start rounded-2xl border bg-card p-5 text-left transition-all animate-in-up shadow-card",
                    "hover:-translate-y-0.5 hover:border-primary/50",
                    isSelected ? "border-primary ring-2 ring-primary/30 shadow-glow" : "border-border"
                  )}
                >
                  {s.isCustom && (
                    <span
                      onClick={(e) => handleDelete(e, s.id)}
                      role="button"
                      aria-label="Eliminar escenario"
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div
                    className={cn(
                      "mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground",
                      s.gradient === "primary" && "gradient-primary",
                      s.gradient === "hostile" && "gradient-hostile",
                      s.gradient === "calm" && "gradient-calm"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.shortDescription}</p>
                  {s.isCustom && (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      Tuyo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section
          className={cn(
            "transition-all duration-500",
            selected ? "opacity-100" : "pointer-events-none opacity-40"
          )}
        >
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            2. Nivel de hostilidad
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(hostilityLabels) as Hostility[]).map((key) => {
              const meta = hostilityLabels[key];
              const isActive = hostility === key;
              return (
                <button
                  key={key}
                  onClick={() => setHostility(key)}
                  className={cn(
                    "rounded-xl border bg-card p-4 text-left transition-all",
                    isActive ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className={cn("text-base font-semibold", meta.color)}>{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button
              size="lg"
              disabled={!selected}
              onClick={handleStartClick}
              className="gradient-primary h-14 px-8 text-base font-semibold text-primary-foreground shadow-glow hover:opacity-95"
            >
              Empezar conversación
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </section>
      </div>

      <CustomScenarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(s) => {
          refresh();
          setSelected(s);
        }}
      />
    </div>
  );
};

export default ScenarioPicker;
