// "Back" is always top-left on every screen.
export function BackLink({ onClick, label = "My scripts" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="back" onClick={onClick}>
      ← {label}
    </button>
  );
}
