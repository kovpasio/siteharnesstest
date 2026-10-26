import type { Rarity } from '@/types';
import { cn, RARITY } from '@/lib/utils';

export function RarityBadge({
  rarity,
  className,
  dot = true,
}: {
  rarity: Rarity;
  className?: string;
  dot?: boolean;
}) {
  const meta = RARITY[rarity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]',
        meta.border,
        meta.soft,
        meta.text,
        className,
      )}
    >
      {dot && (
        <span
          className="h-1 w-1 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
        />
      )}
      {meta.label}
    </span>
  );
}
