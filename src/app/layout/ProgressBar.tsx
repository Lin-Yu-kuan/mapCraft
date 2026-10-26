interface ProgressBarProps {
  progress?: number; // 0 to 100
  label?: string;
  isVisible?: boolean;
}

export function ProgressBar({ progress = 0, label, isVisible = false }: ProgressBarProps) {
  if (!isVisible) return null;

  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="relative w-full bg-slate-200 dark:bg-slate-800 h-1 overflow-hidden" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div
        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default ProgressBar;
