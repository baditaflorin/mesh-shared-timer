import { useEffect, useMemo, useRef, useState } from "react";
import {
  createClockSync,
  MeshButton,
  MeshLaunch,
  MeshNameInput,
  MeshPresence,
  MeshStatusPill,
  MeshSurface,
  useTone,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Timer = {
  /** Absolute mesh-time ms at which the timer ends. 0 = no timer. */
  deadlineMs: number;
  /** When paused, the remaining ms captured at pause time. */
  pausedRemainingMs: number;
  paused: boolean;
  label: string;
};

type Preset = { label: string; ms: number };

const PRESETS: Preset[] = [
  { label: "1 min", ms: 60_000 },
  { label: "5 min", ms: 5 * 60_000 },
  { label: "10 min", ms: 10 * 60_000 },
  { label: "25 min", ms: 25 * 60_000 },
];

const EMPTY_TIMER: Timer = {
  deadlineMs: 0,
  pausedRemainingMs: 0,
  paused: false,
  label: "",
};

function fmtRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSec = Math.ceil(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function deviceLabel(count: number): string {
  return count === 1 ? "device in this room" : "devices in this room";
}

/**
 * A room-first timer: the set-up view stays focused on one real shared action,
 * then the running view makes the agreed finish time impossible to miss.
 */
export function Feature({ room, config }: Props) {
  if (!room) {
    return <ConnectingState displayName={config.displayName ?? "Shared Timer"} />;
  }
  return <Body room={room} config={config} />;
}

function ConnectingState({ displayName }: { displayName: string }) {
  return (
    <main className="timer-page timer-page-connecting">
      <MeshSurface as="section" tone="raised" padding="lg" className="timer-connection-card">
        <MeshStatusPill tone="info" dot announce="polite">
          Connecting to room
        </MeshStatusPill>
        <h1>{displayName}</h1>
        <p>Preparing one shared clock for this room.</p>
      </MeshSurface>
    </main>
  );
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [tick, setTick] = useState(0);
  const [labelDraft, setLabelDraft] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<Preset>(() => PRESETS[1]!);
  const tone = useTone();
  const lastAlarmedDeadline = useRef(0);

  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useEffect(() => () => clock.destroy(), [clock]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timerMap = room.doc.getMap<Timer>("timer");
    const onChange = () => setTick((n) => n + 1);
    timerMap.observe(onChange);
    return () => timerMap.unobserve(onChange);
  }, [room]);

  const yTimer = room.doc.getMap<Timer>("timer");
  const timer = yTimer.get("state") ?? EMPTY_TIMER;
  // `tick` intentionally triggers local display updates between shared writes.
  void tick;

  const now = clock.meshNow();
  const remaining = timer.paused ? timer.pausedRemainingMs : Math.max(0, timer.deadlineMs - now);
  const running = timer.deadlineMs > 0 && !timer.paused && remaining > 0;
  const finished = timer.deadlineMs > 0 && !timer.paused && remaining === 0;
  const participantCount = Math.max(1, room.peerCount + 1);
  const finishedJustNow = finished && timer.deadlineMs !== lastAlarmedDeadline.current;

  useEffect(() => {
    if (!finishedJustNow) return;
    lastAlarmedDeadline.current = timer.deadlineMs;
    tone.sequence([
      { freq: 880, at: 0, gain: 0.4, attack: 0.02, duration: 0.18 },
      { freq: 880, at: 0.25, gain: 0.4, attack: 0.02, duration: 0.18 },
      { freq: 880, at: 0.5, gain: 0.4, attack: 0.02, duration: 0.18 },
    ]);
  }, [finishedJustNow, timer.deadlineMs, tone]);

  const startTimer = (preset: Preset) => {
    yTimer.set("state", {
      deadlineMs: clock.meshNow() + preset.ms,
      pausedRemainingMs: 0,
      paused: false,
      label: labelDraft.trim() || timer.label || "",
    });
  };

  const pause = () => {
    if (timer.deadlineMs === 0 || timer.paused) return;
    yTimer.set("state", {
      ...timer,
      paused: true,
      pausedRemainingMs: Math.max(0, timer.deadlineMs - clock.meshNow()),
    });
  };

  const resume = () => {
    if (!timer.paused) return;
    yTimer.set("state", {
      ...timer,
      deadlineMs: clock.meshNow() + timer.pausedRemainingMs,
      paused: false,
      pausedRemainingMs: 0,
    });
  };

  const reset = () => yTimer.set("state", EMPTY_TIMER);

  if (timer.deadlineMs === 0) {
    return (
      <TimerSetup
        config={config}
        labelDraft={labelDraft}
        onLabelChange={setLabelDraft}
        participantCount={participantCount}
        selectedPreset={selectedPreset}
        onPresetChange={setSelectedPreset}
        onStart={() => startTimer(selectedPreset)}
      />
    );
  }

  return (
    <TimerStage
      label={timer.label}
      remaining={remaining}
      running={running}
      paused={timer.paused}
      finished={finished}
      participantCount={participantCount}
      onPause={pause}
      onResume={resume}
      onReset={reset}
    />
  );
}

type TimerSetupProps = {
  config: MeshConfig;
  labelDraft: string;
  onLabelChange: (value: string) => void;
  participantCount: number;
  selectedPreset: Preset;
  onPresetChange: (preset: Preset) => void;
  onStart: () => void;
};

function TimerSetup({
  config,
  labelDraft,
  onLabelChange,
  participantCount,
  selectedPreset,
  onPresetChange,
  onStart,
}: TimerSetupProps) {
  return (
    <main className="timer-page">
      <MeshLaunch
        className="timer-entry"
        eyebrow="Room countdown"
        heading={config.displayName ?? "Shared Timer"}
        promise="Set one countdown for this room. Every connected device follows the same finish time."
        presence={
          <div className="timer-entry-signals">
            <MeshPresence
              count={participantCount}
              label={deviceLabel(participantCount)}
              state="connected"
              announce="polite"
            />
            <MeshStatusPill tone="success" dot>
              Ready to start
            </MeshStatusPill>
          </div>
        }
        preview={
          <MeshSurface as="section" tone="quiet" padding="md" className="timer-setup-card">
            <div className="timer-setup-summary">
              <span>Selected duration</span>
              <strong aria-live="polite">{fmtRemaining(selectedPreset.ms)}</strong>
            </div>
            <div className="timer-preset-grid" role="group" aria-label="Choose duration">
              {PRESETS.map((preset) => {
                const selected = preset.ms === selectedPreset.ms;
                return (
                  <MeshButton
                    key={preset.label}
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    className="timer-preset"
                    aria-pressed={selected}
                    onClick={() => onPresetChange(preset)}
                  >
                    {preset.label}
                  </MeshButton>
                );
              })}
            </div>
            <MeshNameInput
              className="timer-label-input"
              label="Label (optional)"
              value={labelDraft}
              onChange={onLabelChange}
              placeholder="e.g. Focus block"
              maxLength={48}
            />
          </MeshSurface>
        }
        primaryAction={{
          label: `Start ${selectedPreset.label}`,
          onClick: onStart,
          className: "timer-start-action",
        }}
        connectionHint="Changes are shared with everyone in this room."
      />
    </main>
  );
}

type TimerStageProps = {
  label: string;
  remaining: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  participantCount: number;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
};

function TimerStage({
  label,
  remaining,
  running,
  paused,
  finished,
  participantCount,
  onPause,
  onResume,
  onReset,
}: TimerStageProps) {
  const stateLabel = finished ? "Complete" : paused ? "Paused" : "In progress";
  const stateTone = finished ? "success" : paused ? "warning" : "live";
  const ariaLabel = `${stateLabel}. ${fmtRemaining(remaining)} remaining.`;

  return (
    <main className="timer-page timer-page-stage">
      <section className="timer-stage-layout" aria-labelledby="timer-stage-heading">
        <header className="timer-stage-header">
          <div>
            <p className="timer-stage-eyebrow">Shared countdown</p>
            <h1 id="timer-stage-heading">{label || "Shared Timer"}</h1>
          </div>
          <div className="timer-stage-signals">
            <MeshStatusPill tone={stateTone} dot announce="polite">
              {stateLabel}
            </MeshStatusPill>
            <MeshPresence count={participantCount} label="devices synced" state="connected" />
          </div>
        </header>

        <MeshSurface
          as="section"
          tone="raised"
          padding="lg"
          className="timer-stage"
          data-finished={finished || undefined}
        >
          <p className="timer-stage-caption">
            {finished ? "This room is ready for its next timer." : "Time remaining"}
          </p>
          <div className="timer-big" aria-live="polite" aria-label={ariaLabel}>
            {fmtRemaining(remaining)}
          </div>
          <p className="timer-stage-note">
            {finished
              ? "The finish signal has been shared with the room."
              : paused
                ? "The same remaining time is held for every device."
                : "Everyone in this room is following the same deadline."}
          </p>
        </MeshSurface>

        <footer className="timer-actions" aria-label="Timer controls">
          {running && (
            <MeshButton variant="primary" size="lg" onClick={onPause}>
              Pause timer
            </MeshButton>
          )}
          {paused && (
            <MeshButton variant="primary" size="lg" onClick={onResume}>
              Resume timer
            </MeshButton>
          )}
          <MeshButton variant="secondary" size="lg" onClick={onReset}>
            {finished ? "Start another timer" : "Reset timer"}
          </MeshButton>
        </footer>
      </section>
    </main>
  );
}
