import { cn, formatNumber } from '@/lib/utils';

export function Coin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-[#9DB7D5]/55 bg-gradient-to-br from-[#C4D6E9] via-[#8EACCF] to-[#6085B0] font-display font-extrabold text-[#17202B]',
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
