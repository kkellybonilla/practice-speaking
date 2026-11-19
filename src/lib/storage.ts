// All data stays in this browser. Small records go to localStorage.
// Audio blobs go to IndexedDB (through idb-keyval), because they are larger.
import { del, get, set } from "idb-keyval";
import type { Script, Settings, Take } from "./types";

const KEYS = {
  scripts: "sp.scripts.v1",
  takes: "sp.takes.v1",
  settings: "sp.settings.v1",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  learnerName: "",
  targetDb: null,
  liveVolume: "calm",
  feelingCheck: "after",
  aiFeedback: "off",
};

/** Used until the coach sets a real target. A typical speaking level for a laptop mic. */
export const FALLBACK_TARGET_DB = -26;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Could not save", key, err);
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- Scripts ----------
export function loadScripts(): Script[] {
  return readJson<Script[]>(KEYS.scripts, []);
}

export function saveScripts(scripts: Script[]): void {
  writeJson(KEYS.scripts, scripts);
}

export function getScript(id: string): Script | undefined {
  return loadScripts().find((s) => s.id === id);
}

export function upsertScript(script: Script): void {
  const all = loadScripts();
  const i = all.findIndex((s) => s.id === script.id);
  if (i >= 0) all[i] = script;
  else all.push(script);
  saveScripts(all);
}

export async function deleteScript(id: string): Promise<void> {
  saveScripts(loadScripts().filter((s) => s.id !== id));
  const takes = loadTakes();
  for (const t of takes.filter((t) => t.scriptId === id && t.hasAudio)) {
    await deleteAudio(t.id);
  }
  // The take log keeps the rows, so your test data is not lost.
  saveTakes(takes.map((t) => (t.scriptId === id ? { ...t, hasAudio: false } : t)));
}

/** Last practiced first, then last edited. */
export function sortScripts(scripts: Script[]): Script[] {
  return [...scripts].sort(
    (a, b) => (b.lastPracticedAt ?? b.updatedAt) - (a.lastPracticedAt ?? a.updatedAt),
  );
}

// ---------- Settings ----------
export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(KEYS.settings, {}) };
}

export function saveSettings(settings: Settings): void {
  writeJson(KEYS.settings, settings);
}

export function effectiveTarget(settings: Settings): number {
  return settings.targetDb ?? FALLBACK_TARGET_DB;
}

// ---------- Takes ----------
export function loadTakes(): Take[] {
  return readJson<Take[]>(KEYS.takes, []);
}

export function saveTakes(takes: Take[]): void {
  writeJson(KEYS.takes, takes);
}

export function getTake(id: string): Take | undefined {
  return loadTakes().find((t) => t.id === id);
}

export function updateTake(id: string, patch: Partial<Take>): Take | undefined {
  const takes = loadTakes();
  const i = takes.findIndex((t) => t.id === id);
  if (i < 0) return undefined;
  takes[i] = { ...takes[i], ...patch };
  saveTakes(takes);
  return takes[i];
}

/** Tries for one script, oldest first. */
export function takesForScript(scriptId: string): Take[] {
  return loadTakes()
    .filter((t) => t.scriptId === scriptId)
    .sort((a, b) => a.at - b.at);
}

/**
 * Saves a new take and its audio. Keeps the audio of this take and of kept takes only,
 * so storage stays small.
 */
export async function addTake(take: Take, audio: Blob | null): Promise<void> {
  const takes = loadTakes();
  for (const old of takes) {
    if (old.scriptId === take.scriptId && old.hasAudio && !old.kept) {
      await deleteAudio(old.id);
      old.hasAudio = false;
    }
  }
  if (audio) {
    try {
      await set(audioKey(take.id), audio);
    } catch (err) {
      console.error("Could not save audio", err);
      take.hasAudio = false;
    }
  }
  takes.push(take);
  saveTakes(takes);
}

// ---------- Audio ----------
function audioKey(takeId: string): string {
  return `sp.audio.${takeId}`;
}

export async function getAudio(takeId: string): Promise<Blob | undefined> {
  try {
    return await get<Blob>(audioKey(takeId));
  } catch {
    return undefined;
  }
}

async function deleteAudio(takeId: string): Promise<void> {
  try {
    await del(audioKey(takeId));
  } catch {
    /* ignore */
  }
}
