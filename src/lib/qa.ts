import type { QAPair } from "./types";

// Accepts "Question:", "Q:", "Question 1:", "**Question:**", "1. Question:" and so on.
const Q_RE = /^\s*(?:[-*•]\s*|\d+[.)]\s*)?(?:\*\*|__)?\s*(?:question|q)\s*\d*\s*[:.)-]\s*(?:\*\*|__)?\s*(.*)$/i;
const A_RE = /^\s*(?:[-*•]\s*|\d+[.)]\s*)?(?:\*\*|__)?\s*(?:my answer|answer|a)\s*\d*\s*[:.)-]\s*(?:\*\*|__)?\s*(.*)$/i;

function clean(s: string): string {
  return s.replace(/\*\*|__/g, "").trim();
}

/** Splits ChatGPT's "Question: / Answer:" text into pairs. Returns [] if it finds none. */
export function parseQA(text: string): QAPair[] {
  const pairs: QAPair[] = [];
  let current: QAPair | null = null;
  let field: "q" | "a" | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const q = line.match(Q_RE);
    const a = q ? null : line.match(A_RE);
    if (q) {
      current = { q: clean(q[1]), a: "" };
      pairs.push(current);
      field = "q";
    } else if (a && current) {
      current.a = clean(a[1]);
      field = "a";
    } else if (current && field) {
      // A line without a label continues the last question or answer.
      current[field] = clean(`${current[field]} ${line}`);
    }
  }
  return pairs.filter((p) => p.q.length > 0);
}

/** Script mode: each non-empty line is one sentence. */
export function scriptLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function hasContent(mode: "script" | "qa", text: string, qa: QAPair[]): boolean {
  return mode === "script" ? scriptLines(text).length > 0 : qa.some((p) => p.q.trim().length > 0);
}
