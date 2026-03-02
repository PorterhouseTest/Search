export type Background = "NONE" | "WRESTLER" | "OTHER_MA" | "WEIGHTLIFTER" | "ENDURANCE";
export type Trait = "COMPETITIVE" | "CHILL" | "ANALYTICAL" | "NERVOUS" | "EGO";
export type GymType = "GRACIE" | "MMA" | "SPORT";
export type WeeklyIntent = "TRAIN_HARD" | "FOCUS_LEARNING" | "JUST_SHOW_UP" | "RECOVER";
export type RollAction = "EXPLODE" | "FRAME" | "ADJUST" | "RELAX";

export type Stats = {
  skill: number;
  reputation: number;
  external: number;
  coachTrust: number;
  durability: number;
  momentum: number;
};

export type Tendencies = {
  intensity: number;
  social: number;
  curiosity: number;
};

export type Character = {
  name: string;
  background: Background;
  trait: Trait;
};

export type WeekLog = {
  week: number;
  intent: WeeklyIntent;
  narrative: string;
  sessionLogs: string[];
  lifeEvents: string[];
  dramaEvent?: string;
  validation: string;
  breakthrough?: string;
  sessionsPlanned: number;
};

export type VisitLog = {
  week: number;
  gym: GymType;
  note: string;
  switched: boolean;
};

export type GamePhase =
  | "CHARACTER"
  | "GYM"
  | "WEEK_PLANNING"
  | "SESSION"
  | "WEEK_END"
  | "VISIT_GYM"
  | "MONTH_SUMMARY"
  | "MONTH2_PLACEHOLDER";

export type GameState = {
  phase: GamePhase;
  week: number;
  character?: Character;
  homeGym?: GymType;
  activeWeekIntent?: WeeklyIntent;
  stats: Stats;
  tendencies: Tendencies;
  sessionInWeek: number;
  sessionsThisWeek: number;
  pendingLifeEvents: string[];
  pendingDrama?: string;
  currentPrompt?: string;
  currentPromptFlavor?: string;
  lastRollResult?: string;
  logs: WeekLog[];
  visitLogs: VisitLog[];
  breakthroughsSeen: string[];
  debug: boolean;
};
