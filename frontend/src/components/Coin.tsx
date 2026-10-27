import { cn, formatNumber } from '@/lib/utils';

export function Coin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-[#FFD98F]/70 bg-gradient-to-br from-[#FFE3A8] via-[#F2A54A] to-[#C9772A] font-display font-extrabold text-[#3A2408]',
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
