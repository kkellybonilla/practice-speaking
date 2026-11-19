import { useEffect, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Faces } from "../components/Faces";
import { BulbIcon, MicIcon, PlayIcon, StopIcon } from "../components/Icons";
import { MicError, PracticeSession, type Level } from "../lib/audio";
import { scriptLines } from "../lib/qa";
import { go } from "../lib/route";
import { addTake, effectiveTarget, getScript, loadSettings, newId, upsertScript } from "../lib/storage";
import type { Feeling, Take } from "../lib/types";

type Phase = "feeling-before" | "ready" | "live" | "saving";

// "Before and after" asks once per app session (until the tab closes).
const BEFORE_KEY = "sp.feelingBefore";
function readBefore(): Feeling | undefined {
  try {
    const v = sessionStorage.getItem(BEFORE_KEY);
    return v ? (Number(v) as Feeling) : undefined;
  } catch {
    return undefined;
  }
}
function writeBefore(f: Feeling): void {
  try {
    sessionStorage.setItem(BEFORE_KEY, String(f));
  } catch {
    /* ignore */
  }
}

export function Practice({ id }: { id: string }) {
  // Read once: this screen re-renders about 20 times a second while live.
  const [script] = useState(() => getScript(id));
  const [settings] = useState(loadSettings);
  const targetDb = effectiveTarget(settings);

  const [phase, setPhase] = useState<Phase>(() =>
    settings.feelingCheck === "both" && readBefore() === undefined ? "feeling-before" : "ready",
  );
  const [level, setLevel] = useState<Level>({ closeness: 0, db: null });
  const [error, setError] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const session = useRef<PracticeSession | null>(null);

  // Stop the microphone if the learner leaves the screen.
  useEffect(() => () => session.current?.cancel(), []);

  if (!script) {
    return (
      <div className="screen">
        <div className="topbar">
          <BackLink onClick={() => go({ name: "home" })} />
        </div>
        <main className="main">
          <p>This script is not here anymore.</p>
        </main>
      </div>
    );
  }

  const isQA = script.mode === "qa";
  const lines = scriptLines(script.text);
  const questions = script.qa.filter((p) => p.q.trim());
  const isLastQuestion = qIndex >= questions.length - 1;
  const live = phase === "live";

  const start = async () => {
    setError(null);
    try {
      session.current = await PracticeSession.start({ targetDb, record: true, onLevel: setLevel });
      setPhase("live");
    } catch (err) {
      setError(err instanceof MicError ? err.message : "The microphone did not start. Try again.");
    }
  };

  const finish = async () => {
    const s = session.current;
    if (!s) return;
    setPhase("saving");
    session.current = null;
    const { stats, audio } = await s.stop();
    const take: Take = {
      id: newId(),
      scriptId: script.id,
      scriptName: script.name.trim() || "Untitled script",
      mode: script.mode,
      at: Date.now(),
      durationSec: Math.round(stats.durationSec * 10) / 10,
      voicedSec: Math.round(stats.voicedSec * 10) / 10,
      avgDb: stats.avgDb === null ? null : Math.round(stats.avgDb * 10) / 10,
      targetDb,
      liveVolume: settings.liveVolume,
      feelingCheck: settings.feelingCheck,
      feelingBefore: settings.feelingCheck === "both" ? readBefore() : undefined,
      kept: false,
      hasAudio: audio !== null,
      audioType: audio?.type,
    };
    await addTake(take, audio);
    upsertScript({ ...script, lastPracticedAt: take.at });
    go({ name: "done", takeId: take.id });
  };

  const next = () => {
    if (isLastQuestion) {
      void finish();
      return;
    }
    setQIndex((i) => i + 1);
    setShowAnswer(false); // each question starts with the answer hidden
  };

  const leave = () => {
    session.current?.cancel();
    session.current = null;
    go({ name: "home" });
  };

  const meterOn = settings.liveVolume === "meter";
  const calmOn = settings.liveVolume === "calm";
  const atTarget = level.closeness >= 0.999;

  if (phase === "feeling-before") {
    return (
      <div className="screen">
        <div className="topbar">
          <BackLink onClick={leave} />
        </div>
        <h2 className="title">{script.name.trim() || "Untitled script"}</h2>
        <main className="main">
          <div className="card sk feeling-card">
            <p className="big">How do you feel about speaking right now?</p>
            <Faces
              onPick={(f) => {
                writeBefore(f);
                setPhase("ready");
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="screen">
      {calmOn && live && (
        <div
          className={`glow ${atTarget ? "full" : ""}`}
          style={{ opacity: 0.12 + 0.88 * level.closeness }}
          aria-hidden
        />
      )}
      <div className="topbar">
        <BackLink onClick={leave} />
        {live && settings.liveVolume === "off" && (
          <span className="mic-on muted">
            <MicIcon /> Microphone on
          </span>
        )}
      </div>

      <div className="title-row">
        <h2 className="title">{script.name.trim() || "Untitled script"}</h2>
        {isQA && questions.length > 0 && (
          <span className="muted">
            Question {qIndex + 1} of {questions.length}
          </span>
        )}
      </div>

      <main className={`main practice-main ${meterOn ? "with-meter" : ""}`}>
        <div className="practice-box sk">
          {isQA ? (
            questions.length === 0 ? (
              <p>This script has no questions yet.</p>
            ) : (
              <>
                <p className="q-label muted">Question</p>
                <p className="question">{questions[qIndex].q}</p>
                <button
                  type="button"
                  className={`answer-spot sk ${showAnswer ? "open" : "dashed"}`}
                  onClick={() => setShowAnswer((v) => !v)}
                  aria-expanded={showAnswer}
                >
                  {showAnswer ? (
                    <>
                      <span className="spot-line1 muted">
                        Your answer <span className="hide">Hide</span>
                      </span>
                      <span className="spot-line2 answer">{questions[qIndex].a || "(No answer saved.)"}</span>
                    </>
                  ) : (
                    <>
                      <span className="spot-line1 muted">Answer in your own words.</span>
                      <span className="spot-line2">
                        <BulbIcon /> Want help? Tap to see your answer.
                      </span>
                    </>
                  )}
                </button>
              </>
            )
          ) : (
            <div className="script-read">
              {lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          )}
        </div>

        {meterOn && (
          <div className="meter sk" aria-hidden>
            <span className="meter-target-label">target</span>
            <div className="meter-target" />
            <div
              className={`meter-fill ${atTarget ? "full" : ""}`}
              style={{ height: `${(live ? level.closeness : 0) * 85}%` }}
            />
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-left">
          {phase === "ready" && !error && <span className="muted hint">Tap Start when you are ready.</span>}
          {error && (
            <span className="note" role="alert">
              {error}
            </span>
          )}
        </div>
        {phase === "ready" && (
          <button type="button" className="btn primary" onClick={start} disabled={isQA && questions.length === 0}>
            <MicIcon /> Start
          </button>
        )}
        {live && (!isQA || isLastQuestion) && (
          <button type="button" className="btn primary" onClick={() => void finish()}>
            <StopIcon /> Done
          </button>
        )}
        {live && isQA && !isLastQuestion && (
          <button type="button" className="btn primary" onClick={next}>
            Next <PlayIcon />
          </button>
        )}
        {phase === "saving" && (
          <button type="button" className="btn primary" disabled>
            Saving…
          </button>
        )}
      </footer>
    </div>
  );
}
