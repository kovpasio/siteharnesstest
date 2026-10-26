import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)}>
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-neon-lime/30 bg-neon-lime/10">
        <span className="absolute inset-0 bg-gradient-to-br from-neon-lime/25 to-transparent" />
        <span className="relative font-display text-[15px] font-bold tracking-tighter text-neon-lime">
          D<span className="text-white/40">/</span>Z
        </span>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-[0.12em] text-white">
            DROP<span className="text-neon-lime">.ZONE</span>
          </span>
          <span className="mt-1 text-[8px] font-semibold tracking-[0.3em] text-white/35">
            DOMAIN ROULETTE
          </span>
        </span>
      )}
    </Link>
  );
}
