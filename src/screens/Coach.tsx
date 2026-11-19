import { useEffect, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Segmented } from "../components/Segmented";
import { PracticeSession, TARGET_GATE_DB, closenessFor, type Level } from "../lib/audio";
import { go } from "../lib/route";
import { FALLBACK_TARGET_DB, loadSettings, loadTakes, saveSettings } from "../lib/storage";
import type { AiFeedback, FeelingCheck, LiveVolume, Settings, Take } from "../lib/types";
import { downloadBlob } from "../lib/wav";

const MEASURE_SEC = 5;
const FEELING_WORD: Record<number, string> = { 1: "not good", 2: "OK", 3: "good" };

function toCsv(takes: Take[]): string {
  const cols = [
    "date",
    "script",
    "mode",
    "duration_sec",
    "voiced_sec",
    "avg_db",
    "target_db",
    "db_vs_target",
    "live_volume",
    "feeling_check",
    "feeling_before",
    "feeling_after",
    "kept",
  ];
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = takes.map((t) =>
    [
      new Date(t.at).toISOString(),
      t.scriptName,
      t.mode,
      t.durationSec,
      t.voicedSec,
      t.avgDb,
      t.targetDb,
      t.avgDb === null ? "" : Math.round((t.avgDb - t.targetDb) * 10) / 10,
      t.liveVolume,
      t.feelingCheck,
      t.feelingBefore,
      t.feelingAfter,
      t.kept,
    ]
      .map(esc)
      .join(","),
  );
  return [cols.join(","), ...rows].join("\n");
}

export function Coach() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [measuring, setMeasuring] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MEASURE_SEC);
  const [level, setLevel] = useState<Level>({ closeness: 0, db: null });
  const [note, setNote] = useState<string | null>(null);
  const session = useRef<PracticeSession | null>(null);
  const takes = loadTakes().sort((a, b) => b.at - a.at);
  const learner = settings.learnerName.trim() || "The learner";
  const learnerInSentence = settings.learnerName.trim() || "the learner";

  useEffect(() => () => session.current?.cancel(), []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const setTarget = async () => {
    setNote(null);
    try {
      session.current = await PracticeSession.start({
        targetDb: settings.targetDb ?? FALLBACK_TARGET_DB,
        gateDb: TARGET_GATE_DB,
        record: false,
        onLevel: setLevel,
      });
    } catch (err) {
      setNote(err instanceof Error ? err.message : "The microphone did not start.");
      return;
    }
    setMeasuring(true);
    for (let s = MEASURE_SEC; s > 0; s--) {
      setSecondsLeft(s);
      await new Promise((r) => setTimeout(r, 1000));
    }
    const s = session.current;
    session.current = null;
    setMeasuring(false);
    if (!s) return;
    const { stats } = await s.stop();
    if (stats.avgDb === null || stats.voicedSec < 1) {
      setNote("No voice heard. Try again, and keep speaking for the whole 5 seconds.");
      return;
    }
    update({ targetDb: Math.round(stats.avgDb * 10) / 10 });
    setNote(`Target saved: ${stats.avgDb.toFixed(1)} dB.`);
  };

  const nudge = (delta: number) => {
    const base = settings.targetDb ?? FALLBACK_TARGET_DB;
    update({ targetDb: Math.round((base + delta) * 10) / 10 });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv([...takes].reverse())], { type: "text/csv" });
    downloadBlob(blob, `take-log-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <BackLink onClick={() => go({ name: "home" })} />
      </div>
      <h2 className="title">Coach settings</h2>
      <p className="muted">
        For testing only. {learner} does not need these. Everything is saved in this browser only.
      </p>

      <main className="main coach-main">
        <section className="coach-row">
          <label className="coach-label" htmlFor="learner-name">
            Name on Home
          </label>
          <input
            id="learner-name"
            className="field sk"
            placeholder="First name"
            value={settings.learnerName}
            onChange={(e) => update({ learnerName: e.target.value })}
          />
        </section>

        <section className="coach-row">
          <span className="coach-label">Target</span>
          <div className="coach-target">
            <p>
              {settings.targetDb === null ? (
                <b>Not set yet.</b>
              ) : (
                <>
                  Set to <b>{settings.targetDb.toFixed(1)} dB</b> on this laptop.
                </>
              )}{" "}
              Stand at the back of the room while {learnerInSentence} speaks from the front. When you hear them clearly, tap Set target. Keep speaking for 5 seconds.
            </p>
            <div className="coach-target-actions">
              <button type="button" className="btn primary" onClick={setTarget} disabled={measuring}>
                {measuring ? `Listening… ${secondsLeft}` : "Set target"}
              </button>
              <button type="button" className="btn small" onClick={() => nudge(-2)} disabled={measuring}>
                Easier (−2 dB)
              </button>
              <button type="button" className="btn small" onClick={() => nudge(2)} disabled={measuring}>
                Harder (+2 dB)
              </button>
            </div>
            {measuring && (
              <div className="hbar sk" aria-hidden>
                <div
                  className="hbar-fill"
                  style={{ width: `${closenessFor(level.db, settings.targetDb ?? FALLBACK_TARGET_DB) * 100}%` }}
                />
              </div>
            )}
            {note && <p className="note" role="status">{note}</p>}
          </div>
        </section>

        <section className="coach-row">
          <span className="coach-label">Live volume</span>
          <Segmented<LiveVolume>
            label="Live volume"
            value={settings.liveVolume}
            onChange={(liveVolume) => update({ liveVolume })}
            options={[
              { value: "meter", label: "Meter" },
              { value: "calm", label: "Calm" },
              { value: "off", label: "Off" },
            ]}
          />
        </section>

        <section className="coach-row">
          <span className="coach-label">Feeling check</span>
          <Segmented<FeelingCheck>
            label="Feeling check"
            value={settings.feelingCheck}
            onChange={(feelingCheck) => update({ feelingCheck })}
            options={[
              { value: "off", label: "Off" },
              { value: "after", label: "After each" },
              { value: "both", label: "Before + after" },
            ]}
          />
        </section>

        <section className="coach-row">
          <span className="coach-label">AI feedback</span>
          <Segmented<AiFeedback>
            label="AI feedback"
            value={settings.aiFeedback}
            onChange={(aiFeedback) => update({ aiFeedback })}
            options={[
              { value: "off", label: "Off" },
              { value: "gemini", label: "Gemini link" },
            ]}
          />
        </section>

        <section className="take-log">
          <div className="take-log-head">
            <h3>Take log</h3>
            <button type="button" className="btn small" onClick={exportCsv} disabled={takes.length === 0}>
              Export CSV
            </button>
          </div>
          {takes.length === 0 ? (
            <p className="muted">No tries yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Script</th>
                    <th>Mode</th>
                    <th>Volume vs target</th>
                    <th>Live volume</th>
                    <th>Feeling</th>
                    <th>Kept</th>
                  </tr>
                </thead>
                <tbody>
                  {takes.map((t) => (
                    <tr key={t.id}>
                      <td>{new Date(t.at).toLocaleString()}</td>
                      <td>{t.scriptName}</td>
                      <td>{t.mode === "qa" ? "Q&A" : "Script"}</td>
                      <td className="num">
                        {t.avgDb === null ? "no voice" : `${(t.avgDb - t.targetDb).toFixed(1)} dB`}
                      </td>
                      <td>{t.liveVolume}</td>
                      <td>
                        {[t.feelingBefore && `before: ${FEELING_WORD[t.feelingBefore]}`, t.feelingAfter && `after: ${FEELING_WORD[t.feelingAfter]}`]
                          .filter(Boolean)
                          .join(", ") || "–"}
                      </td>
                      <td>{t.kept ? "yes" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
