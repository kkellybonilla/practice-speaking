// The Done message. It must always be true, and it never says "missed" or "failed".

export interface DoneMessage {
  title: string;
  detail: string;
}

const LOUDER_DB = 1; // a difference smaller than this is noise, not progress

export function doneMessage(opts: {
  /** This try's average level (dBFS), or null if no voice was heard. */
  current: number | null;
  /** Earlier tries of this script, oldest first (nulls are ignored). */
  earlier: (number | null)[];
  targetDb: number;
  /** Tries in the last 7 days, this one included. */
  triesThisWeek: number;
}): DoneMessage {
  const { current, targetDb, triesThisWeek } = opts;
  const earlier = opts.earlier.filter((x): x is number => x !== null);

  if (current === null) {
    return {
      title: "Nice work practicing.",
      detail: "The app could not hear your voice this time. Check the microphone, then try again.",
    };
  }

  const keptUp = "Great job keeping your volume up!";
  if (earlier.length > 0 && current > earlier[0] + LOUDER_DB) {
    return { title: keptUp, detail: "You were louder than your first try." };
  }
  if (earlier.length > 0 && current > earlier[earlier.length - 1] + LOUDER_DB) {
    return { title: keptUp, detail: "You were louder than last time." };
  }
  if (current >= targetDb - LOUDER_DB) {
    return { title: keptUp, detail: "Your voice reached the target." };
  }
  if (earlier.length === 0) {
    return {
      title: "Nice work practicing your volume.",
      detail: "Your first try is saved. Next time, you can see your progress.",
    };
  }
  return {
    title: "Nice work practicing your volume.",
    detail: triesThisWeek === 1 ? "You practiced today." : `You practiced ${triesThisWeek} times this week.`,
  };
}
