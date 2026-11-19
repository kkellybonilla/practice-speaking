import type { Feeling } from "../lib/types";

const FACES: { value: Feeling; label: string; mouth: string }[] = [
  { value: 1, label: "Not good", mouth: "M14 33 q10 -8 20 0" },
  { value: 2, label: "OK", mouth: "M15 30 h18" },
  { value: 3, label: "Good", mouth: "M13 27 q11 11 22 0" },
];

export function Faces({
  value,
  onPick,
}: {
  value?: Feeling;
  onPick: (f: Feeling) => void;
}) {
  return (
    <div className="faces" role="radiogroup" aria-label="How did that feel?">
      {FACES.map((f) => (
        <button
          key={f.value}
          type="button"
          role="radio"
          aria-checked={value === f.value}
          aria-label={f.label}
          title={f.label}
          className={`face sk ${value === f.value ? "picked" : ""}`}
          onClick={() => onPick(f.value)}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
            <circle cx="17" cy="19" r="2.6" fill="currentColor" />
            <circle cx="31" cy="19" r="2.6" fill="currentColor" />
            <path d={f.mouth} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
