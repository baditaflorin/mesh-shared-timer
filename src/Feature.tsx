import { useEffect, useMemo, useRef, useState } from "react";
import { createClockSync, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Timer = {
  /** Absolute mesh-time ms at which the timer ends. 0 = no timer. */
  deadlineMs: number;
  /** When paused, the remaining ms captured at pause time. */
  pausedRemainingMs: number;
  paused: boolean;
  label: string;
};

const PRESETS: Array<{ label: string; ms: number }> = [
  { label: "1 min", ms: 60_000 },
  { label: "5 min", ms: 5 * 60_000 },
  { label: "10 min", ms: 10 * 60_000 },
  { label: "25 min", ms: 25 * 60_000 },
];

function fmtRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSec = Math.ceil(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="timer-screen">
        <h1>shared timer</h1>
        <p className="timer-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room }: { room: YRoom; config: MeshConfig }) {
  const [tick, setTick] = useState(0);
  const [labelDraft, setLabelDraft] = useState("");
  const alarmRef = useRef<AudioContext | null>(null);
  const lastAlarmedDeadline = useRef(0);

  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useEffect(() => () => clock.destroy(), [clock]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const m = room.doc.getMap<Timer>("timer");
    const onChange = () => setTick((n) => n + 1);
    m.observe(onChange);
    return () => m.unobserve(onChange);
  }, [room]);

  const yTimer = room.doc.getMap<Timer>("timer");
  const t: Timer = yTimer.get("state") ?? {
    deadlineMs: 0,
    pausedRemainingMs: 0,
    paused: false,
    label: "",
  };
  void tick;

  const now = clock.meshNow();
  const remaining = t.paused ? t.pausedRemainingMs : Math.max(0, t.deadlineMs - now);
  const running = t.deadlineMs > 0 && !t.paused && remaining > 0;
  const finishedJustNow =
    t.deadlineMs > 0 &&
    !t.paused &&
    remaining === 0 &&
    t.deadlineMs !== lastAlarmedDeadline.current;

  useEffect(() => {
    if (!finishedJustNow) return;
    lastAlarmedDeadline.current = t.deadlineMs;
    try {
      alarmRef.current ??= new AudioContext();
      const ctx = alarmRef.current;
      const start = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g).connect(ctx.destination);
        o.frequency.value = 880;
        const at = start + i * 0.25;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        o.start(at);
        o.stop(at + 0.2);
      }
    } catch {
      // ignored — first run before user gesture
    }
  }, [finishedJustNow, t.deadlineMs]);

  const startTimer = (ms: number) => {
    yTimer.set("state", {
      deadlineMs: clock.meshNow() + ms,
      pausedRemainingMs: 0,
      paused: false,
      label: labelDraft.trim() || t.label || "timer",
    });
  };
  const pause = () => {
    if (t.deadlineMs === 0 || t.paused) return;
    yTimer.set("state", {
      ...t,
      paused: true,
      pausedRemainingMs: Math.max(0, t.deadlineMs - clock.meshNow()),
    });
  };
  const resume = () => {
    if (!t.paused) return;
    yTimer.set("state", {
      ...t,
      deadlineMs: clock.meshNow() + t.pausedRemainingMs,
      paused: false,
      pausedRemainingMs: 0,
    });
  };
  const reset = () =>
    yTimer.set("state", { deadlineMs: 0, pausedRemainingMs: 0, paused: false, label: "" });

  return (
    <div className="timer-screen" data-finished={!running && t.deadlineMs > 0 && remaining === 0}>
      <header className="timer-header">
        <h1>shared timer</h1>
        <p className="timer-status">
          {room.peerCount + 1} device{room.peerCount === 0 ? "" : "s"} synced
        </p>
      </header>

      <div className="timer-big" aria-live="polite">
        {fmtRemaining(remaining)}
      </div>
      {t.label && <div className="timer-label-display">{t.label}</div>}

      <input
        className="timer-label-input"
        placeholder="label (optional)"
        value={labelDraft}
        onChange={(e) => setLabelDraft(e.target.value)}
        maxLength={48}
      />

      <div className="timer-presets">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => startTimer(p.ms)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="timer-actions">
        {!t.paused && running && (
          <button type="button" onClick={pause}>
            pause
          </button>
        )}
        {t.paused && (
          <button type="button" onClick={resume}>
            resume
          </button>
        )}
        {t.deadlineMs > 0 && (
          <button type="button" className="timer-reset" onClick={reset}>
            reset
          </button>
        )}
      </div>
    </div>
  );
}
