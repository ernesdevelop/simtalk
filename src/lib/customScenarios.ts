import { useEffect, useState } from "react";
import type { Scenario } from "./scenarios";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "custom-scenarios-v1";

export interface CustomScenarioInput {
  title: string;
  shortDescription: string;
  context: string;
  opener: string;
}

export interface StoredCustomScenario extends CustomScenarioInput {
  id: string;
  createdAt: number;
}

export function loadCustomScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: StoredCustomScenario[] = JSON.parse(raw);
    return list.map(toScenario);
  } catch {
    return [];
  }
}

export function saveCustomScenario(input: CustomScenarioInput): Scenario {
  const stored: StoredCustomScenario = {
    ...input,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  const existing = readRaw();
  const next = [stored, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return toScenario(stored);
}

export function deleteCustomScenario(id: string) {
  const next = readRaw().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function readRaw(): StoredCustomScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toScenario(s: StoredCustomScenario): Scenario {
  return {
    id: s.id,
    title: s.title,
    shortDescription: s.shortDescription,
    context: s.context,
    opener: s.opener,
    icon: Sparkles,
    gradient: "calm",
    isCustom: true,
  };
}

export function useCustomScenarios() {
  const [items, setItems] = useState<Scenario[]>([]);
  useEffect(() => {
    setItems(loadCustomScenarios());
  }, []);
  const refresh = () => setItems(loadCustomScenarios());
  return { items, refresh };
}
