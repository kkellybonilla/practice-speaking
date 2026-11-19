// Prompts are written in the learner's voice. They read them when ChatGPT or Gemini opens.
// Edit the wording here after you write it with them.
import type { Mode, Script } from "./types";
import { scriptLines } from "./qa";

export const SCRIPT_PROMPT =
  "Help me write a short script that I will practice saying out loud. " +
  "First, ask me what it is for and what it is about, one question at a time. " +
  "If I have slides, I will upload them. Use short, simple sentences. " +
  "Ask me before you change my ideas. " +
  "At the end, write only my script in one message, one sentence on each line.";

export const QA_PROMPT =
  "Help me get ready to answer questions out loud, for example in a class discussion. " +
  "First, ask me what it is about. If I have slides, I will upload them. " +
  "Find 3 to 5 questions people could ask me. For each question, give me 2 short answer ideas. " +
  "I will pick one or change it. Ask about one question at a time. Use short, simple sentences. " +
  "At the end, write only the questions and my answers in one message, like this:\n" +
  "Question: ...\nAnswer: ...";

export function chatGptUrl(mode: Mode): string {
  // The ?q= parameter is unofficial. It fills in and sends the prompt.
  const prompt = mode === "qa" ? QA_PROMPT : SCRIPT_PROMPT;
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}

export function feedbackPrompt(script: Script): string {
  const body =
    script.mode === "qa"
      ? script.qa.map((p) => `Question: ${p.q}\nAnswer: ${p.a}`).join("\n")
      : scriptLines(script.text).join("\n");
  return (
    "I attached a recording of me practicing out loud. My script is below. " +
    "Give me feedback on my voice: how strong and steady it was, and how confident I sounded. " +
    "Tell me 2 things I did well and 1 thing to try next time. Use short, simple sentences. " +
    "You do not need to write out my words.\n\nMy script:\n" +
    body
  );
}

export function geminiUrl(prompt: string): string {
  // Unofficial: some reports say Gemini reads ?prompt=. The app also copies the prompt,
  // so the learner can paste it if the link does not fill it in.
  return `https://gemini.google.com/app?prompt=${encodeURIComponent(prompt)}`;
}
