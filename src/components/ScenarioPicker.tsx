import { useState } from "react";
import { scenarios, hostilityLabels, type Scenario, type Hostility } from "@/lib/scenarios";
import { Button } from "@/components/ui/button";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onStart: (scenario: Scenario, hostility: Hostility) => void;
}

const ScenarioPicker = ({ onStart }: Props) => {
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [hostility, setHostility] = useState<Hostility>("medium");

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
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            1. Elige un escenario
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((s, i) => {
              const Icon = s.icon;
              const isSelected = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={cn(
                    "group relative flex flex-col items-start rounded-2xl border bg-card p-5 text-left transition-all animate-in-up shadow-card",
                    "hover:-translate-y-0.5 hover:border-primary/50",
                    isSelected ? "border-primary ring-2 ring-primary/30 shadow-glow" : "border-border"
                  )}
                >
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

          <div className="mt-10 flex justify-center">
            <Button
              size="lg"
              disabled={!selected}
              onClick={() => selected && onStart(selected, hostility)}
              className="gradient-primary h-14 px-8 text-base font-semibold text-primary-foreground shadow-glow hover:opacity-95"
            >
              Empezar conversación
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ScenarioPicker;
