/** Small display pieces shared by the Lab's panels. */

export function Tag({
  simulated,
  text,
  hidden = false,
}: {
  simulated: boolean;
  text: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  // The words carry the meaning; colour only reinforces it. Purple is reserved for SIMULATED.
  const style = simulated ? "bg-sim text-void" : "border border-hairline text-text-1";
  return (
    <span
      role="status"
      className={`rounded-md px-2 py-0.5 font-condensed text-xs font-semibold uppercase tracking-widest ${style}`}
    >
      {text}
    </span>
  );
}

export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-glass px-3 py-2">
      <dt className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-2">
        {label}
      </dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}
