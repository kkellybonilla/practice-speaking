import { useEffect, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Faces } from "../components/Faces";
import { PauseIcon, PlayIcon } from "../components/Icons";
import { closenessFor } from "../lib/audio";
import { doneMessage } from "../lib/progress";
import { feedbackPrompt, geminiUrl } from "../lib/prompts";
import { go } from "../lib/route";
import { getAudio, getScript, getTake, loadSettings, loadTakes, takesForScript, updateTake } from "../lib/storage";
import type { Feeling, Take } from "../lib/types";
import { downloadBlob, safeFileName, toWav } from "../lib/wav";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BARS = 4;

export function Done({ takeId }: { takeId: string }) {
  const [take, setTake] = useState<Take | undefined>(() => getTake(takeId));
  const [settings] = useState(loadSettings);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      audioEl.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    },
    [],
  );

  if (!take) {
    return (
      <div className="screen">
        <div className="topbar">
          <BackLink onClick={() => go({ name: "home" })} />
        </div>
        <main className="main">
          <p>This try is not here anymore.</p>
        </main>
      </div>
    );
  }

  const script = getScript(take.scriptId);
  const askFeeling = take.feelingCheck !== "off" && take.feelingAfter === undefined;

  const all = takesForScript(take.scriptId);
  const index = all.findIndex((t) => t.id === take.id);
  const earlier = all.slice(0, Math.max(0, index));
  const triesThisWeek = loadTakes().filter((t) => t.at > Date.now() - WEEK_MS).length;
  const message = doneMessage({
    current: take.avgDb,
    earlier: earlier.map((t) => t.avgDb),
    targetDb: take.targetDb,
    triesThisWeek,
  });
  const barTakes = [...earlier.slice(-(BARS - 1)), take];
  const firstBarNumber = index - barTakes.length + 2;

  const pickFeeling = (f: Feeling) => setTake(updateTake(take.id, { feelingAfter: f }));

  const toggleListen = async () => {
    if (playing) {
      audioEl.current?.pause();
      return;
    }
    if (!audioEl.current) {
      const blob = await getAudio(take.id);
      if (!blob) {
        setNote("The recording of this try is not saved.");
        return;
      }
      audioUrl.current = URL.createObjectURL(blob);
      audioEl.current = new Audio(audioUrl.current);
      audioEl.current.onended = () => setPlaying(false);
      audioEl.current.onpause = () => setPlaying(false);
      audioEl.current.onplay = () => setPlaying(true);
    }
    void audioEl.current.play();
  };

  const toggleKeep = () => setTake(updateTake(take.id, { kept: !take.kept }));

  const getFeedback = async () => {
    if (!script) return;
    const prompt = feedbackPrompt(script);
    // Copy first and open the tab at once, while the click still counts as a user action.
    const copied = navigator.clipboard.writeText(prompt).then(
      () => true,
      () => false,
    );
    window.open(geminiUrl(prompt), "_blank", "noopener");
    const blob = await getAudio(take.id);
    if (!blob) {
      setNote("The recording of this try is not saved, so there is no file to attach.");
      return;
    }
    try {
      const wav = await toWav(blob);
      downloadBlob(wav, `${safeFileName(take.scriptName)}-try-${index + 1}.wav`);
      setNote(
        (await copied)
          ? "The recording is in your Downloads folder, and the prompt is copied. In Gemini, attach the file. If the prompt is not there, paste it."
          : "The recording is in your Downloads folder. In Gemini, attach the file and ask for feedback on your voice.",
      );
    } catch {
      setNote("The recording could not be saved as a file.");
    }
  };

  return (
    <div className="screen">
      <div className="topbar">
        <BackLink onClick={() => go({ name: "home" })} />
      </div>

      <main className="main done-main">
        {take.feelingCheck !== "off" && (
          <div className="card sk feeling-card">
            <p className="big">How did that feel?</p>
            <Faces value={take.feelingAfter} onPick={pickFeeling} />
          </div>
        )}

        {!askFeeling && (
          <div className="card sk progress-card">
            <p className="big b">{message.title}</p>
            <p>{message.detail}</p>
            <div className="bars" aria-label="Your volume, try by try">
              <div className="bars-target" />
              <span className="bars-target-label">target</span>
              {barTakes.map((t, i) => {
                const c = closenessFor(t.avgDb, take.targetDb);
                const isThis = t.id === take.id;
                return (
                  <div className="bar-col" key={t.id}>
                    <div
                      className={`bar ${isThis ? "this" : ""} ${c >= 0.999 ? "full" : ""}`}
                      style={{ height: `${Math.max(4, c * 80)}%` }}
                    />
                    <span className={`bar-label ${isThis ? "b" : "muted"}`}>
                      {isThis ? "this try" : `try ${firstBarNumber + i}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {note && <p className="note" role="status">{note}</p>}
      </main>

      <footer className="footer">
        <div className="footer-left">
          {take.hasAudio && (
            <>
              <button type="button" className="btn" onClick={toggleListen}>
                {playing ? <PauseIcon /> : <PlayIcon />} {playing ? "Pause" : "Listen"}
              </button>
              <button type="button" className="btn" onClick={toggleKeep} aria-pressed={take.kept}>
                {take.kept ? "★ Kept" : "☆ Keep"}
              </button>
            </>
          )}
          {settings.aiFeedback === "gemini" && take.hasAudio && script && (
            <button type="button" className="btn" onClick={getFeedback}>
              Feedback ↗
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!script}
          onClick={() => script && go({ name: "practice", id: script.id })}
        >
          Practice again
        </button>
      </footer>
    </div>
  );
}
