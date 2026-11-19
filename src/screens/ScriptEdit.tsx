import { useEffect, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { PlayIcon } from "../components/Icons";
import { Segmented } from "../components/Segmented";
import { chatGptUrl } from "../lib/prompts";
import { hasContent, parseQA } from "../lib/qa";
import { go } from "../lib/route";
import { deleteScript, getScript, newId, upsertScript } from "../lib/storage";
import type { Mode, QAPair, Script } from "../lib/types";

function blankScript(): Script {
  const now = Date.now();
  return { id: newId(), name: "", mode: "script", text: "", qa: [{ q: "", a: "" }], createdAt: now, updatedAt: now };
}

export function ScriptEdit({ id }: { id: string }) {
  const isNew = id === "new";
  const [script, setScript] = useState<Script>(() => (isNew ? blankScript() : getScript(id) ?? blankScript()));
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ready = hasContent(script.mode, script.text, script.qa);
  const savedOnce = useRef(!isNew);

  // Autosave. A new script is saved once it has a name or some text.
  useEffect(() => {
    const worthSaving = script.name.trim() !== "" || ready;
    if (!worthSaving && !savedOnce.current) return;
    upsertScript(script);
    if (isNew && !savedOnce.current) {
      savedOnce.current = true;
      // Replace "#/script/new" so Back and reload open this script.
      go({ name: "script", id: script.id }, true);
    }
  }, [script, ready, isNew]);

  const update = (patch: Partial<Script>) => setScript((s) => ({ ...s, ...patch, updatedAt: Date.now() }));

  const setPair = (i: number, patch: Partial<QAPair>) =>
    update({ qa: script.qa.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const removePair = (i: number) => {
    const qa = script.qa.filter((_, j) => j !== i);
    update({ qa: qa.length ? qa : [{ q: "", a: "" }] });
  };

  const pasteText = (text: string) => {
    if (script.mode === "script") {
      const joined = script.text.trim() ? `${script.text.trimEnd()}\n${text.trim()}` : text.trim();
      update({ text: joined });
      setNote(null);
      return;
    }
    const pairs = parseQA(text);
    if (pairs.length === 0) {
      setNote('No questions found. ChatGPT\'s answer needs lines that start with "Question:" and "Answer:".');
      return;
    }
    // New questions go below the ones he already has, so nothing is lost.
    const existing = script.qa.filter((p) => p.q.trim() || p.a.trim());
    update({ qa: [...existing, ...pairs] });
    setNote(null);
  };

  const onPasteFromChatGpt = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setNote("Nothing to paste. In ChatGPT, tap the copy icon under the answer first.");
        return;
      }
      pasteText(text);
    } catch {
      setNote("Paste is blocked. Click in the box and press Cmd+V.");
      textRef.current?.focus();
    }
  };

  const onDelete = async () => {
    await deleteScript(script.id);
    go({ name: "home" });
  };

  const practice = () => {
    upsertScript(script);
    go({ name: "practice", id: script.id });
  };

  const modeOptions: { value: Mode; label: string }[] = [
    { value: "script", label: "Script" },
    { value: "qa", label: "Q&A" },
  ];

  return (
    <div className="screen">
      <div className="topbar">
        <BackLink onClick={() => go({ name: "home" })} />
        {savedOnce.current &&
          (confirmDelete ? (
            <span className="confirm">
              Delete this script?{" "}
              <button type="button" className="link danger" onClick={onDelete}>
                Yes, delete
              </button>{" "}
              <button type="button" className="link" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </span>
          ) : (
            <button type="button" className="link muted" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ))}
      </div>

      <input
        id="script-name"
        className="name-field sk"
        placeholder="Name your script"
        value={script.name}
        onChange={(e) => update({ name: e.target.value })}
        aria-label="Script name"
      />

      <div className="mode-row">
        <span className="muted">Practice as</span>
        <Segmented label="Practice as" value={script.mode} options={modeOptions} onChange={(mode) => update({ mode })} />
      </div>

      <main className="main">
        {script.mode === "script" ? (
          <textarea
            id="script-text"
            ref={textRef}
            className="script-text sk"
            placeholder="Write or paste your script here. One sentence on each line."
            value={script.text}
            onChange={(e) => update({ text: e.target.value })}
          />
        ) : (
          <div className="qa-edit sk">
            {script.qa.map((p, i) => (
              <div className="qa-pair" key={i}>
                <label className="qa-label" htmlFor={`q-${i}`}>
                  Question
                </label>
                <input
                  id={`q-${i}`}
                  className="field sk"
                  placeholder="Type a question"
                  value={p.q}
                  onChange={(e) => setPair(i, { q: e.target.value })}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (parseQA(text).length > 0) {
                      e.preventDefault();
                      pasteText(text);
                    }
                  }}
                />
                <label className="qa-label" htmlFor={`a-${i}`}>
                  Answer
                </label>
                <textarea
                  id={`a-${i}`}
                  className="field sk"
                  rows={2}
                  placeholder="Type your answer"
                  value={p.a}
                  onChange={(e) => setPair(i, { a: e.target.value })}
                />
                {script.qa.length > 1 && (
                  <button type="button" className="link muted remove" onClick={() => removePair(i)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="link add" onClick={() => update({ qa: [...script.qa, { q: "", a: "" }] })}>
              + Add question
            </button>
          </div>
        )}
        {note && <p className="note" role="status">{note}</p>}
      </main>

      <footer className="footer">
        <div className="footer-left">
          <a className="btn" href={chatGptUrl(script.mode)} target="_blank" rel="noopener noreferrer">
            Write it with ChatGPT ↗
          </a>
          <button type="button" className="btn" onClick={onPasteFromChatGpt}>
            Paste from ChatGPT
          </button>
        </div>
        <button type="button" className="btn primary" disabled={!ready} onClick={practice}>
          Practice <PlayIcon />
        </button>
      </footer>
    </div>
  );
}
