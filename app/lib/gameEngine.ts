import breakthroughs from "@/app/content/breakthroughs.json";
import dramaEvents from "@/app/content/dramaEvents.json";
import lifeEvents from "@/app/content/lifeEvents.json";
import rollPrompts from "@/app/content/rollPrompts.json";
import validations from "@/app/content/validations.json";
import { GameState, GymType, RollAction, Stats, Tendencies, Trait, WeeklyIntent } from "./types";

const clamp = (value: number, min = -10, max = 10) => Math.max(min, Math.min(max, Math.round(value)));

export const initialState: GameState = {
  phase: "CHARACTER",
  week: 1,
  stats: { skill: 0, reputation: 0, external: 0, coachTrust: 0, durability: 0, momentum: 0 },
  tendencies: { intensity: 0, social: 0, curiosity: 0 },
  sessionInWeek: 0,
  sessionsThisWeek: 0,
  pendingLifeEvents: [],
  logs: [],
  visitLogs: [],
  breakthroughsSeen: [],
  debug: false
};

export const traitNudges: Record<Trait, Partial<Stats & Tendencies>> = {
  COMPETITIVE: { intensity: 2, momentum: 1 },
  CHILL: { social: 1, durability: 1 },
  ANALYTICAL: { curiosity: 2, skill: 1 },
  NERVOUS: { external: -1, curiosity: 1 },
  EGO: { intensity: 2, reputation: -1 }
};

export function applyDelta(state: GameState, delta: Partial<Stats & Tendencies>): GameState {
  const stats: Stats = { ...state.stats };
  const tendencies: Tendencies = { ...state.tendencies };

  (Object.keys(delta) as (keyof (Stats & Tendencies))[]).forEach((key) => {
    const value = delta[key] ?? 0;
    if (key in stats) {
      stats[key as keyof Stats] = clamp((stats[key as keyof Stats] as number) + value);
    } else {
      tendencies[key as keyof Tendencies] = clamp((tendencies[key as keyof Tendencies] as number) + value);
    }
  });

  return { ...state, stats, tendencies };
}

export function weeklySessions(state: GameState): number {
  const { external, durability, momentum } = state.stats;
  const total = 3 + (external >= 2 ? 1 : 0) + (durability >= 2 ? 1 : 0) - (external <= -3 ? 1 : 0) - (durability <= -3 ? 1 : 0) - (momentum <= -4 ? 1 : 0);
  return Math.max(2, Math.min(4, total));
}

export function pickPrompt(gym: GymType, week: number): string {
  const options = rollPrompts[gym] as string[];
  return options[(week - 1 + Math.floor(Math.random() * options.length)) % options.length];
}

function passesConditions(item: any, state: GameState): boolean {
  const c = item.conditions ?? {};
  if (c.minWeek && state.week < c.minWeek) return false;
  if (c.minSkill && state.stats.skill < c.minSkill) return false;
  if (c.minReputation && state.stats.reputation < c.minReputation) return false;
  if (c.minCoachTrust && state.stats.coachTrust < c.minCoachTrust) return false;
  if (c.minCuriosity && state.tendencies.curiosity < c.minCuriosity) return false;
  if (c.minSocial && state.tendencies.social < c.minSocial) return false;
  return true;
}

export function pickLifeEvents(state: GameState): any[] {
  const possible = lifeEvents.filter((e) => passesConditions(e, state));
  const count = Math.random() < 0.4 ? 2 : 1;
  return shuffle(possible).slice(0, count);
}

export function pickDrama(state: GameState): any | undefined {
  if (Math.random() > 0.3) return undefined;
  const possible = dramaEvents.filter((d) => passesConditions(d, state));
  return shuffle(possible)[0];
}

export function pickValidation(state: GameState): any {
  const possible = validations.filter((v) => passesConditions(v, state));
  return shuffle(possible)[0] ?? validations[2];
}

export function pickBreakthrough(state: GameState): any | undefined {
  const eligible = breakthroughs.filter((b) => passesConditions(b, state) && !state.breakthroughsSeen.includes(b.id));
  if (!eligible.length) return undefined;
  const chance = state.week >= 3 ? 0.65 : 0.45;
  if (Math.random() > chance) return undefined;
  return shuffle(eligible)[0];
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function resolveRoll(action: RollAction, quality: "Perfect" | "Good" | "Poor", state: GameState, intent: WeeklyIntent) {
  const base: Record<RollAction, Partial<Stats & Tendencies>> = {
    EXPLODE: { skill: 0, reputation: -1, durability: -1, intensity: 2, momentum: 1 },
    FRAME: { skill: 1, reputation: 1, coachTrust: 1, curiosity: 1 },
    ADJUST: { skill: 1, reputation: 1, curiosity: 1, momentum: 1 },
    RELAX: { durability: 1, external: 1, social: 1, intensity: -1 }
  };

  const intentBias: Record<WeeklyIntent, Partial<Stats & Tendencies>> = {
    TRAIN_HARD: { intensity: 1, durability: -1, skill: 1 },
    FOCUS_LEARNING: { curiosity: 1, skill: 1, coachTrust: 1 },
    JUST_SHOW_UP: { momentum: 1, social: 1 },
    RECOVER: { durability: 2, external: 1, intensity: -1 }
  };

  const qualityMult = quality === "Perfect" ? 2 : quality === "Good" ? 1 : 0;
  const delta: Partial<Stats & Tendencies> = {};

  for (const [k, v] of Object.entries(base[action])) {
    delta[k as keyof (Stats & Tendencies)] = (delta[k as keyof (Stats & Tendencies)] ?? 0) + v * (qualityMult || 1);
  }
  for (const [k, v] of Object.entries(intentBias[intent])) {
    delta[k as keyof (Stats & Tendencies)] = (delta[k as keyof (Stats & Tendencies)] ?? 0) + v;
  }
  if (quality === "Poor") {
    delta.external = (delta.external ?? 0) - 1;
    delta.momentum = (delta.momentum ?? 0) - 1;
  }

  const narrative = `${action.toLowerCase()} with ${quality.toLowerCase()} timing`; 
  return { delta, narrative };
}

export function getVibe(state: GameState): string {
  const { momentum, durability, external } = state.stats;
  if (momentum <= -3) return "You are dragging a bit. Showing up is still a win.";
  if (durability <= -2) return "Body is talking. You need smart rounds and clean choices.";
  if (external <= -2) return "Life is noisy this week. Training might be your anchor.";
  return "You are finding rhythm, even if every class still feels mysterious.";
}
