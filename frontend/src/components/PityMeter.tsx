import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PityMeter({
  counter,
  threshold,
  compact = false,
  className,
}: {
  counter: number;
  threshold: number;
  compact?: boolean;
  className?: string;
}) {
  const progress = Math.min(100, (counter / threshold) * 100);
  const remaining = Math.max(0, threshold - counter);
  const guaranteed = counter >= threshold;

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5',
        guaranteed && 'border-rarity-epic/35 bg-rarity-epic/[0.06]',
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
          <Flame
            size={12}
            className={guaranteed ? 'text-rarity-epic' : 'text-rarity-legendary'}
          />
          Pity-система
        </span>
        <span className="font-display text-[10px] font-semibold tabular-nums text-white/55">
          {counter}/{threshold}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-rarity-epic to-rarity-legendary transition-all duration-500',
            guaranteed && 'animate-pulse',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      {!compact && (
        <p className="mt-2 text-[10px] text-white/30">
          {guaranteed
            ? 'Следующий дроп гарантированно Epic+'
            : `${remaining} спинов без Epic+ — и следующий станет Epic+`}
        </p>
      )}
    </div>
  );
}
