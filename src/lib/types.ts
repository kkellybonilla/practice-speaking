export type Mode = "script" | "qa";

export interface QAPair {
  q: string;
  a: string;
}

export interface Script {
  id: string;
  name: string;
  mode: Mode;
  /** Script mode: one sentence per line. */
  text: string;
  /** Q&A mode: question and answer pairs. */
  qa: QAPair[];
  createdAt: number;
  updatedAt: number;
  lastPracticedAt?: number;
}

/** 1 = not good, 2 = OK, 3 = good. */
export type Feeling = 1 | 2 | 3;

export type LiveVolume = "calm" | "meter" | "off";
export type FeelingCheck = "off" | "after" | "both";
export type AiFeedback = "off" | "gemini";

export interface Settings {
  learnerName: string;
  /** Target level in dBFS. null = the coach has not set it yet. */
  targetDb: number | null;
  liveVolume: LiveVolume;
  feelingCheck: FeelingCheck;
  aiFeedback: AiFeedback;
}

/** One practice try. The take log keeps these; audio is stored apart. */
export interface Take {
  id: string;
  scriptId: string;
  scriptName: string;
  mode: Mode;
  at: number;
  durationSec: number;
  /** Seconds with voice above the pause gate. */
  voicedSec: number;
  /** Mean level of the voiced frames, in dBFS. null = no voice heard. */
  avgDb: number | null;
  targetDb: number;
  liveVolume: LiveVolume;
  feelingCheck: FeelingCheck;
  feelingBefore?: Feeling;
  feelingAfter?: Feeling;
  kept: boolean;
  hasAudio: boolean;
  audioType?: string;
}
