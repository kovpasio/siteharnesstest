import { cn, formatNumber } from '@/lib/utils';

export function Coin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-[#e8ff9b]/50 bg-gradient-to-br from-[#e8ff9b] via-[#b6ff3b] to-[#75c300] font-display font-extrabold text-[#1b2403] shadow-[0_0_14px_rgba(182,255,59,.35)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.52 }}
      aria-hidden
    >
      D
    </span>
  );
}

export function Balance({
  value,
  size = 18,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Coin size={size} />
      <span className="font-display font-bold tabular-nums tracking-tight">{formatNumber(value)}</span>
    </span>
  );
}
