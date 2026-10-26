import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.028] p-3.5',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-1.5">
        <span className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-white/32 min-[360px]:tracking-[0.14em]">
          {label}
        </span>
        <Icon
          size={14}
          className="hidden shrink-0 min-[360px]:block"
          style={{ color: accent ?? 'rgba(255,255,255,.35)' }}
        />
      </div>
      <div className="font-display text-xl font-bold tracking-tight text-white">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-white/32">{hint}</div>}
    </div>
  );
}
