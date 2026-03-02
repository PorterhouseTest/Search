"use client";

import { useEffect, useMemo, useState } from "react";
import gyms from "@/app/content/gyms.json";
import { TimingMeter } from "@/app/components/TimingMeter";
import { applyDelta, getVibe, initialState, pickBreakthrough, pickDrama, pickLifeEvents, pickPrompt, pickValidation, resolveRoll, traitNudges, weeklySessions } from "@/app/lib/gameEngine";
import { Background, GameState, GymType, RollAction, Trait, WeeklyIntent } from "@/app/lib/types";

const STORAGE_KEY = "bjj-first-month-save";

const backgrounds: Background[] = ["NONE", "WRESTLER", "OTHER_MA", "WEIGHTLIFTER", "ENDURANCE"];
const traits: Trait[] = ["COMPETITIVE", "CHILL", "ANALYTICAL", "NERVOUS", "EGO"];
const intents: WeeklyIntent[] = ["TRAIN_HARD", "FOCUS_LEARNING", "JUST_SHOW_UP", "RECOVER"];

export default function Home() {
  const [state, setState] = useState<GameState>(initialState);
  const [name, setName] = useState("");
  const [background, setBackground] = useState<Background>("NONE");
  const [trait, setTrait] = useState<Trait>("CHILL");
  const [rollTarget, setRollTarget] = useState<RollAction>("FRAME");

  useEffect(() => {
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage) {
      setState(JSON.parse(fromStorage));
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      setState((s) => ({ ...s, debug: true }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const meterSpeed = useMemo(() => {
    const stress = -state.stats.external;
    const body = -state.stats.durability;
    const momentumHelp = state.stats.momentum;
    return Math.max(0.35, Math.min(1.6, 0.85 + stress * 0.08 + body * 0.05 - momentumHelp * 0.04));
  }, [state.stats]);

  const createCharacter = () => {
    const created = applyDelta(
      {
        ...state,
        character: { name: name.trim() || "New White Belt", background, trait },
        phase: "GYM"
      },
      background === "WRESTLER"
        ? { skill: 1, intensity: 1 }
        : background === "OTHER_MA"
          ? { skill: 1, curiosity: 1 }
          : background === "WEIGHTLIFTER"
            ? { durability: 1, intensity: 1 }
            : background === "ENDURANCE"
              ? { durability: 1, external: 1 }
              : { curiosity: 1 }
    );
    setState(applyDelta(created, traitNudges[trait]));
  };

  const chooseGym = (homeGym: GymType) => {
    setState((s) => ({ ...s, homeGym, phase: "WEEK_PLANNING" }));
  };

  const startWeek = (intent: WeeklyIntent) => {
    setState((s) => {
      const withIntent = { ...s, activeWeekIntent: intent, sessionsThisWeek: weeklySessions(s), sessionInWeek: 0 };
      const life = pickLifeEvents(withIntent);
      const drama = pickDrama(withIntent);
      return {
        ...withIntent,
        pendingLifeEvents: life.map((e) => e.id),
        pendingDrama: drama?.id,
        currentPrompt: pickPrompt(withIntent.homeGym as GymType, withIntent.week),
        phase: "SESSION"
      };
    });
  };

  const resolveSession = (action: RollAction, quality: "Perfect" | "Good" | "Poor") => {
    setState((s) => {
      const result = resolveRoll(action, quality, s, s.activeWeekIntent as WeeklyIntent);
      let next = applyDelta(s, result.delta);
      const nextSession = s.sessionInWeek + 1;

      if (nextSession >= s.sessionsThisWeek) {
        const lifePicked = pickLifeEvents(next);
        const lifeText = lifePicked.map((e) => e.text);
        lifePicked.forEach((e) => {
          next = applyDelta(next, e.effects);
        });

        const drama = pickDrama(next);
        if (drama) next = applyDelta(next, drama.effects);

        const validation = pickValidation(next);
        const breakthrough = pickBreakthrough(next);
        if (breakthrough) next = applyDelta(next, breakthrough.effects);

        const log = {
          week: s.week,
          intent: s.activeWeekIntent as WeeklyIntent,
          narrative: getVibe(next),
          sessionLogs: Array.from({ length: s.sessionsThisWeek }).map((_, idx) => `Session ${idx + 1}: ${idx + 1 === nextSession ? `You ${result.narrative}.` : "Complete."}`),
          lifeEvents: lifeText,
          dramaEvent: drama?.text,
          validation: validation.text.replace("{name}", s.character?.name ?? "you"),
          breakthrough: breakthrough?.text,
          sessionsPlanned: s.sessionsThisWeek
        };

        return {
          ...next,
          logs: [...s.logs.filter((l) => l.week !== s.week), log],
          breakthroughsSeen: breakthrough ? [...s.breakthroughsSeen, breakthrough.id] : s.breakthroughsSeen,
          sessionInWeek: nextSession,
          lastRollResult: `You chose ${action} (${quality}).`,
          phase: "WEEK_END"
        };
      }

      return {
        ...next,
        sessionInWeek: nextSession,
        currentPrompt: pickPrompt(next.homeGym as GymType, next.week),
        lastRollResult: `You chose ${action} (${quality}).`
      };
    });
  };

  const nextWeek = () => {
    setState((s) => {
      if (s.week === 4) return { ...s, phase: "MONTH_SUMMARY" };
      const canVisit = s.week >= 2;
      return { ...s, phase: canVisit ? "VISIT_GYM" : "WEEK_PLANNING", week: s.week + 1 };
    });
  };

  const visitGym = (gym: GymType, switchHome: boolean) => {
    setState((s) => {
      let next = { ...s, visitLogs: [...s.visitLogs, { week: s.week, gym, note: `Visited ${gym} and felt the contrast immediately.`, switched: switchHome }] };
      if (switchHome) {
        next = applyDelta({ ...next, homeGym: gym }, { reputation: -2, coachTrust: -2, curiosity: 1, momentum: 1 });
      } else {
        next = applyDelta(next, { curiosity: 1, skill: 1 });
      }
      return { ...next, phase: "WEEK_PLANNING" };
    });
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  };

  return (
    <main className="container">
      <header>
        <h1>BJJ First Month Simulator</h1>
        <p>Weeks 1 to 4. Survive, learn, and become less confused.</p>
      </header>
      <div className="toolbar">
        <button onClick={() => setState((s) => ({ ...s, debug: !s.debug }))}>Debug {state.debug ? "On" : "Off"}</button>
        <button onClick={reset}>Reset</button>
      </div>

      {state.phase === "CHARACTER" && (
        <section className="card">
          <h2>Create Character</h2>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <label>Background</label>
          <select value={background} onChange={(e) => setBackground(e.target.value as Background)}>
            {backgrounds.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label>Trait</label>
          <select value={trait} onChange={(e) => setTrait(e.target.value as Trait)}>
            {traits.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button className="primary" onClick={createCharacter}>Enter the mats</button>
        </section>
      )}

      {state.phase === "GYM" && (
        <section className="card">
          <h2>Pick a Home Gym</h2>
          <div className="grid">
            {gyms.map((gym) => (
              <article key={gym.id} className="tile">
                <h3>{gym.name}</h3>
                <p>{gym.description}</p>
                <small>{gym.quirk}</small>
                <p><em>{gym.vibe}</em></p>
                <button className="primary" onClick={() => chooseGym(gym.id as GymType)}>Train here</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {state.phase === "WEEK_PLANNING" && (
        <section className="card">
          <h2>Week {state.week} Planning</h2>
          <p>{getVibe(state)}</p>
          <p>Home gym: {state.homeGym}</p>
          <p>Sessions likely this week: {weeklySessions(state)}</p>
          <label>Weekly intent</label>
          <div className="row">
            {intents.map((intent) => (
              <button key={intent} onClick={() => startWeek(intent)}>{intent.replaceAll("_", " ")}</button>
            ))}
          </div>
        </section>
      )}

      {state.phase === "SESSION" && (
        <section className="card">
          <h2>Week {state.week}, Session {state.sessionInWeek + 1} / {state.sessionsThisWeek}</h2>
          <p>{state.currentPrompt}</p>
          <label>Pick your intended response</label>
          <select value={rollTarget} onChange={(e) => setRollTarget(e.target.value as RollAction)}>
            <option>EXPLODE</option>
            <option>FRAME</option>
            <option>ADJUST</option>
            <option>RELAX</option>
          </select>
          <TimingMeter target={rollTarget} speed={meterSpeed} skillBonus={state.stats.skill} onStop={resolveSession} />
          {state.lastRollResult && <p>{state.lastRollResult}</p>}
          
        </section>
      )}

      {state.phase === "WEEK_END" && (
        <section className="card">
          <h2>Week {state.week} End</h2>
          <p>{state.logs.find((l) => l.week === state.week)?.validation ?? "Small wins happened."}</p>
          <p>{state.logs.find((l) => l.week === state.week)?.breakthrough ?? "No big breakthrough, but progress is real."}</p>
          <button className="primary" onClick={nextWeek}>Continue</button>
        </section>
      )}

      {state.phase === "VISIT_GYM" && (
        <section className="card">
          <h2>Visit Other Gym</h2>
          <p>You can drop in once and sense the vibe. Switching can cost trust and rep.</p>
          <div className="grid">
            {(["GRACIE", "MMA", "SPORT"] as GymType[]).filter((g) => g !== state.homeGym).map((gym) => (
              <article key={gym} className="tile">
                <h3>{gym}</h3>
                <div className="row">
                  <button onClick={() => visitGym(gym, false)}>Visit only</button>
                  <button onClick={() => visitGym(gym, true)}>Switch home gym</button>
                </div>
              </article>
            ))}
          </div>
          <button onClick={() => setState((s) => ({ ...s, phase: "WEEK_PLANNING" }))}>Skip visit</button>
        </section>
      )}

      {state.phase === "MONTH_SUMMARY" && (
        <section className="card">
          <h2>Month 1 Summary</h2>
          <p>You are not brand new anymore. Your timing, nerves, and social map all changed.</p>
          <ul>
            <li>Skill trend: {state.stats.skill >= 2 ? "Visible improvement" : "Early foundations"}</li>
            <li>Reputation trend: {state.stats.reputation >= 1 ? "People trust your rounds" : "Still earning trust"}</li>
            <li>Coach trust trend: {state.stats.coachTrust >= 2 ? "Coach notices your consistency" : "Coach is still learning your game"}</li>
            <li>Durability trend: {state.stats.durability >= 0 ? "Body adapting" : "Recovery needs attention"}</li>
          </ul>
          <button className="primary" onClick={() => setState((s) => ({ ...s, phase: "MONTH2_PLACEHOLDER" }))}>Continue to Month 2</button>
        </section>
      )}

      {state.phase === "MONTH2_PLACEHOLDER" && (
        <section className="card">
          <h2>Coming next</h2>
          <p>Stripes, first competition thoughts, and deeper gym relationships are coming in Month 2.</p>
        </section>
      )}

      {state.debug && (
        <section className="card debug">
          <h3>Debug panel</h3>
          <pre>{JSON.stringify({ stats: state.stats, tendencies: state.tendencies, week: state.week, phase: state.phase }, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
