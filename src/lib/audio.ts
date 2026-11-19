// Volume measurement and recording. Everything runs on this laptop.
// No speech recognition: the app only measures loudness.

/** Frames quieter than (target - GATE_DB) count as a pause and are ignored. */
export const GATE_DB = 22;
/** The live display goes from (target - RANGE_DB) = empty to target = full. */
export const RANGE_DB = 20;
const FRAME_MS = 50;

export interface TryStats {
  durationSec: number;
  voicedSec: number;
  avgDb: number | null;
}

export interface Level {
  /** 0 = far from the target, 1 = at or above the target. */
  closeness: number;
  db: number | null;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function closenessFor(db: number | null, targetDb: number): number {
  if (db === null) return 0;
  return clamp((db - (targetDb - RANGE_DB)) / RANGE_DB, 0, 1);
}

export function rmsDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  return 20 * Math.log10(rms + 1e-12);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Raw microphone settings. Auto gain control must be off: it makes quiet speech
 * louder and loud speech quieter, so the volume would look flat.
 */
async function openMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      noiseSuppression: false,
      echoCancellation: false,
      channelCount: 1,
    },
  });
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((t) => MediaRecorder.isTypeSupported(t));
}

export class MicError extends Error {}

/**
 * One practice try: measures volume about 20 times a second and records audio.
 * The microphone is open only between start() and stop().
 */
export class PracticeSession {
  private stream: MediaStream;
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private timer: number | undefined;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private voicedFrames: number[] = [];
  private smoothed: number | null = null;
  private startedAt = performance.now();
  readonly mimeType: string | undefined;

  private constructor(
    stream: MediaStream,
    private gateDb: number,
    private targetDb: number,
    private onLevel: (level: Level) => void,
    record: boolean,
  ) {
    this.stream = stream;
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    this.mimeType = record ? pickMimeType() : undefined;
    if (record && typeof MediaRecorder !== "undefined") {
      this.recorder = new MediaRecorder(stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(1000);
    }

    const buf = new Float32Array(this.analyser.fftSize);
    this.timer = window.setInterval(() => {
      this.analyser.getFloatTimeDomainData(buf);
      this.tick(rmsDb(buf));
    }, FRAME_MS);
  }

  /**
   * targetDb: the coach's target. gateDb: frames below this are pauses.
   * For a normal try, gateDb = targetDb - GATE_DB.
   */
  static async start(opts: {
    targetDb: number;
    gateDb?: number;
    record: boolean;
    onLevel: (level: Level) => void;
  }): Promise<PracticeSession> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError("This browser cannot use the microphone. Use Chrome.");
    }
    let stream: MediaStream;
    try {
      stream = await openMic();
    } catch {
      throw new MicError("The microphone is not allowed. Allow it in Chrome, then try again.");
    }
    return new PracticeSession(
      stream,
      opts.gateDb ?? opts.targetDb - GATE_DB,
      opts.targetDb,
      opts.onLevel,
      opts.record,
    );
  }

  private tick(db: number): void {
    if (db > this.gateDb) {
      this.voicedFrames.push(db);
      this.smoothed = this.smoothed === null ? db : this.smoothed * 0.7 + db * 0.3;
    } else if (this.smoothed !== null) {
      // During a pause the display settles slowly. A pause is never "wrong".
      this.smoothed = this.smoothed - 0.8;
      if (this.smoothed < this.gateDb) this.smoothed = null;
    }
    this.onLevel({ closeness: closenessFor(this.smoothed, this.targetDb), db: this.smoothed });
  }

  /** Stops the microphone. Returns the stats and the recording (if any). */
  async stop(): Promise<{ stats: TryStats; audio: Blob | null }> {
    window.clearInterval(this.timer);
    let audio: Blob | null = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        this.recorder!.onstop = () => resolve();
        this.recorder!.stop();
      });
      audio = this.chunks.length ? new Blob(this.chunks, { type: this.recorder.mimeType || this.mimeType }) : null;
    }
    this.stream.getTracks().forEach((t) => t.stop());
    await this.ctx.close().catch(() => undefined);
    const durationSec = (performance.now() - this.startedAt) / 1000;
    return {
      audio,
      stats: {
        durationSec,
        voicedSec: (this.voicedFrames.length * FRAME_MS) / 1000,
        avgDb: mean(this.voicedFrames),
      },
    };
  }

  /** Stops without keeping anything (for example, when the learner leaves the screen). */
  cancel(): void {
    window.clearInterval(this.timer);
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      /* ignore */
    }
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close().catch(() => undefined);
  }
}

/** Absolute gate for setting the target: ignore room noise below this level. */
export const TARGET_GATE_DB = -55;
