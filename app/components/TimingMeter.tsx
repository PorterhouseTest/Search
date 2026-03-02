"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RollAction } from "@/app/lib/types";

const actions: RollAction[] = ["EXPLODE", "FRAME", "ADJUST", "RELAX"];

type Props = {
  target: RollAction;
  speed: number;
  skillBonus: number;
  onStop: (action: RollAction, quality: "Perfect" | "Good" | "Poor") => void;
};

export function TimingMeter({ target, speed, skillBonus, onStop }: Props) {
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [running, setRunning] = useState(true);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setPos((p) => {
        const next = p + dir * speed;
        if (next >= 100) {
          setDir(-1);
          return 100;
        }
        if (next <= 0) {
          setDir(1);
          return 0;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [dir, running, speed]);

  const zones = useMemo(() => {
    const bonus = Math.min(4, skillBonus * 0.35);
    return actions.map((action, i) => {
      const start = i * 25;
      let size = 25;
      if (action === target) size += 5 + bonus;
      return { action, start, end: Math.min(100, start + size) };
    });
  }, [target, skillBonus]);

  const stop = () => {
    if (!running) return;
    setRunning(false);
    const zone = zones.find((z) => pos >= z.start && pos <= z.end) ?? zones[zones.length - 1];
    const center = (zone.start + zone.end) / 2;
    const diff = Math.abs(pos - center);
    const width = zone.end - zone.start;
    const quality = diff < width * 0.15 ? "Perfect" : diff < width * 0.33 ? "Good" : "Poor";
    onStop(zone.action, quality);
  };

  return (
    <div className="meterWrap">
      <div className="meter">
        {zones.map((z) => (
          <div
            key={z.action}
            className={`zone ${z.action === target ? "target" : ""}`}
            style={{ left: `${z.start}%`, width: `${z.end - z.start}%` }}
          >
            {z.action}
          </div>
        ))}
        <div className="indicator" style={{ left: `${pos}%` }} />
      </div>
      <button onClick={stop} className="primary">STOP</button>
    </div>
  );
}
