import { Briefcase, Heart, Users, MessageCircleWarning, UserMinus, HandCoins, type LucideIcon } from "lucide-react";

export type Hostility = "low" | "medium" | "high";

export interface Scenario {
  id: string;
  title: string;
  shortDescription: string;
  context: string;
  icon: LucideIcon;
  gradient: "primary" | "hostile" | "calm";
  opener: string;
  isCustom?: boolean;
}

export const scenarios: Scenario[] = [
  {
    id: "raise",
    title: "Pedir un aumento",
    shortDescription: "Negocia tu salario con un jefe escéptico.",
    context:
      "El usuario es un empleado con 2 años en la empresa que va a pedirle un aumento de sueldo a su jefe directo. Tú eres el jefe: directivo de una empresa con presupuesto ajustado este año.",
    icon: HandCoins,
    gradient: "primary",
    opener: "Bueno, ya estoy aquí. Dime, ¿de qué querías hablarme? Tengo una reunión en 15 minutos.",
  },
  {
    id: "breakup",
    title: "Terminar una relación",
    shortDescription: "Una conversación honesta y difícil de pareja.",
    context:
      "El usuario quiere terminar una relación amorosa de 3 años. Tú eres su pareja, no esperabas esto, te sientes herido/a y confundido/a.",
    icon: Heart,
    gradient: "hostile",
    opener: "Me estás asustando con esa cara… ¿Qué pasa? ¿Hice algo mal?",
  },
  {
    id: "feedback-employee",
    title: "Dar feedback negativo",
    shortDescription: "Comunícale a un colega que su trabajo no rinde.",
    context:
      "El usuario es manager y debe dar feedback negativo sobre rendimiento bajo a un miembro de su equipo. Tú eres ese empleado: orgulloso/a, te crees buen trabajador/a y no esperas críticas.",
    icon: MessageCircleWarning,
    gradient: "primary",
    opener: "Hola, ¿querías verme? Espero que sea rápido, estoy hasta arriba con el proyecto.",
  },
  {
    id: "roommate",
    title: "Conflicto con tu compañero de piso",
    shortDescription: "Hablar de la limpieza y el respeto en casa.",
    context:
      "El usuario quiere hablar con su compañero/a de piso porque nunca limpia, hace ruido de noche y trae gente sin avisar. Tú eres ese compañero/a, no ves el problema y crees que el usuario exagera.",
    icon: Users,
    gradient: "calm",
    opener: "¿Qué pasa? Me has dicho que querías hablar de algo importante…",
  },
  {
    id: "boundaries-family",
    title: "Poner límites a un familiar",
    shortDescription: "Frena la intromisión de un familiar cercano.",
    context:
      "El usuario quiere poner límites a un familiar (madre/padre/suegro) que se entromete constantemente en su vida personal y decisiones. Tú eres ese familiar: cariñoso/a pero invasivo/a, crees que lo haces 'por su bien'.",
    icon: UserMinus,
    gradient: "hostile",
    opener: "¡Hola cariño! Qué bien que llamaste. Oye, he estado pensando en ti y…",
  },
  {
    id: "fire",
    title: "Despedir a alguien",
    shortDescription: "Comunica un despido con respeto y firmeza.",
    context:
      "El usuario es responsable de RRHH y debe comunicarle a un empleado que está siendo despedido por reestructuración. Tú eres ese empleado: llevas 5 años, no lo ves venir, vas a reaccionar con shock y enfado.",
    icon: Briefcase,
    gradient: "primary",
    opener: "Hola, me dijiste que viniera. ¿Pasa algo? Te veo seria…",
  },
];

export const hostilityLabels: Record<Hostility, { label: string; description: string; color: string }> = {
  low: { label: "Bajo", description: "Reticente pero abierto/a", color: "text-success" },
  medium: { label: "Medio", description: "Defensivo/a y molesto/a", color: "text-warning" },
  high: { label: "Alto", description: "Muy hostil y cortante", color: "text-destructive" },
};
