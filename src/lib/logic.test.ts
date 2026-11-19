import { describe, expect, it } from "vitest";
import { closenessFor, rmsDb } from "./audio";
import { doneMessage } from "./progress";
import { parseQA, scriptLines } from "./qa";
import { encodeWav } from "./wav";

describe("parseQA", () => {
  it("reads ChatGPT's Question/Answer format", () => {
    const text = "Here are your questions:\n\nQuestion: What is AI?\nAnswer: A tool.\n\nQuestion: Why practice?\nAnswer: To feel ready.";
    expect(parseQA(text)).toEqual([
      { q: "What is AI?", a: "A tool." },
      { q: "Why practice?", a: "To feel ready." },
    ]);
  });

  it("accepts bold labels, numbers and short labels", () => {
    const text = "1. **Question 1:** What did you learn?\n**Answer:** AI is a co-worker.\nQ: Next one?\nA: Yes.";
    expect(parseQA(text)).toEqual([
      { q: "What did you learn?", a: "AI is a co-worker." },
      { q: "Next one?", a: "Yes." },
    ]);
  });

  it("joins a line without a label to the last answer", () => {
    expect(parseQA("Question: Q1\nAnswer: first part\nsecond part")).toEqual([
      { q: "Q1", a: "first part second part" },
    ]);
  });

  it("does not treat a normal sentence as a label", () => {
    expect(parseQA("Question: Hi?\nAnswer: Hello.\nA lot of people agree.")).toEqual([
      { q: "Hi?", a: "Hello. A lot of people agree." },
    ]);
  });

  it("returns nothing for text with no questions", () => {
    expect(parseQA("Hello everyone.\nThanks for listening.")).toEqual([]);
  });
});

describe("scriptLines", () => {
  it("drops empty lines", () => {
    expect(scriptLines("One.\n\n  Two.  \n")).toEqual(["One.", "Two."]);
  });
});

describe("doneMessage", () => {
  const base = { targetDb: -24, triesThisWeek: 3 };

  it("praises volume when louder than the first try", () => {
    expect(doneMessage({ ...base, current: -27, earlier: [-31, -26] })).toEqual({
      title: "Great job keeping your volume up!",
      detail: "You were louder than your first try.",
    });
  });

  it("compares to last time when not louder than the first try", () => {
    expect(doneMessage({ ...base, current: -27, earlier: [-26, -30] }).detail).toBe("You were louder than last time.");
  });

  it("names the target when the voice reaches it", () => {
    expect(doneMessage({ ...base, current: -24.5, earlier: [] }).detail).toBe("Your voice reached the target.");
  });

  it("stays positive and true on a quieter day", () => {
    const m = doneMessage({ ...base, current: -32, earlier: [-28, -29] });
    expect(m.title).toBe("Nice work practicing your volume.");
    expect(m.detail).toBe("You practiced 3 times this week.");
  });

  it("handles a first try below the target", () => {
    expect(doneMessage({ ...base, current: -32, earlier: [] }).detail).toMatch(/first try is saved/);
  });

  it("handles no voice", () => {
    expect(doneMessage({ ...base, current: null, earlier: [-28] }).detail).toMatch(/could not hear/);
  });
});

describe("audio math", () => {
  it("full-scale sine is about -3 dBFS", () => {
    const s = new Float32Array(4800);
    for (let i = 0; i < s.length; i++) s[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    expect(rmsDb(s)).toBeCloseTo(-3.01, 1);
  });

  it("closeness goes from 0 to 1 over the range", () => {
    expect(closenessFor(-50, -24)).toBe(0);
    expect(closenessFor(-34, -24)).toBeCloseTo(0.5);
    expect(closenessFor(-20, -24)).toBe(1);
    expect(closenessFor(null, -24)).toBe(0);
  });

  it("writes a valid WAV header", async () => {
    const wav = encodeWav(new Float32Array(16000), 16000);
    const view = new DataView(await wav.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(16000);
    expect(wav.size).toBe(44 + 32000);
  });
});
