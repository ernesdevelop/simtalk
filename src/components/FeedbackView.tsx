import { useEffect, useState } from "react";
import type { Msg } from "./ChatView";
import type { Scenario, Hostility } from "@/lib/scenarios";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertCircle, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


const FEEDBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feedback`;

interface Feedback {
  assertiveness_score: number;
  overall_summary: string;
  strengths: string[];
  improvements: string[];
  tips: string[];
  rewrite_example: { original: string; improved: string; explanation: string };
}

interface Props {
  messages: Msg[];
  scenario: Scenario;
  hostility: Hostility;
  onBack: () => void;
  onRestart: () => void;
}

const FeedbackView = ({ messages, scenario, hostility, onBack, onRestart }: Props) => {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(FEEDBACK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages,
            scenarioTitle: scenario.title,
            scenarioContext: scenario.context,
            hostility,
          }),
        });
        const data = await resp.json();
        if (cancelled) return;
        if (!resp.ok || data?.error) throw new Error(data?.error || `HTTP ${resp.status}`);
        setFeedback(data.feedback);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "No se pudo generar el feedback");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [messages, scenario, hostility]);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver al chat
          </Button>
          <Button onClick={onRestart} variant="outline" size="sm">
            <RefreshCw className="mr-1 h-4 w-4" /> Nuevo escenario
          </Button>
        </header>

        {loading && <LoadingState />}

        {!loading && feedback && (
          <div className="space-y-6 animate-in-up">
            <ScoreCard score={feedback.assertiveness_score} summary={feedback.overall_summary} />

            <Section icon={CheckCircle2} title="Fortalezas" tone="success">
              <ul className="space-y-2">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                    {s}
                  </li>
                ))}
              </ul>
            </Section>

            <Section icon={AlertCircle} title="Áreas de mejora" tone="warning">
              <ul className="space-y-2">
                {feedback.improvements.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                    {s}
                  </li>
                ))}
              </ul>
            </Section>

            <Section icon={Lightbulb} title="Consejos prácticos" tone="primary">
              <ul className="space-y-2">
                {feedback.tips.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {s}
                  </li>
                ))}
              </ul>
            </Section>

            <Section icon={Sparkles} title="Cómo podrías haber dicho esto mejor" tone="accent">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu frase</div>
                  <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm italic">
                    "{feedback.rewrite_example.original}"
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Versión mejorada</div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    "{feedback.rewrite_example.improved}"
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{feedback.rewrite_example.explanation}</p>
              </div>
            </Section>

            <div className="pt-4 text-center">
              <Button onClick={onRestart} size="lg" className="gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
                Practicar otro escenario
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ScoreCard = ({ score, summary }: { score: number; summary: string }) => {
  const tone =
    score >= 75 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center gap-5">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-border">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(hsl(var(--primary)) ${score * 3.6}deg, transparent 0deg)`,
              mask: "radial-gradient(circle, transparent 56%, black 58%)",
              WebkitMask: "radial-gradient(circle, transparent 56%, black 58%)",
            }}
          />
          <div className={cn("text-2xl font-bold", tone)}>{score}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asertividad</div>
          <p className="mt-1 text-sm leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
};

const Section = ({
  icon: Icon, title, tone, children,
}: { icon: any; title: string; tone: "success" | "warning" | "primary" | "accent"; children: React.ReactNode }) => {
  const toneMap = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    primary: "text-primary bg-primary/10",
    accent: "text-accent bg-accent/10",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
};

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="relative mb-6 h-16 w-16">
      <div className="absolute inset-0 rounded-full gradient-primary opacity-30 animate-ping" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full gradient-primary shadow-glow">
        <Sparkles className="h-7 w-7 text-primary-foreground" />
      </div>
    </div>
    <h2 className="text-lg font-semibold">Analizando tu conversación…</h2>
    <p className="mt-1 text-sm text-muted-foreground">Evaluando asertividad, tono y manejo emocional.</p>
  </div>
);

export default FeedbackView;
