import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)}>
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-accent/35 bg-gradient-to-br from-accent/25 via-accent/10 to-teal/10 shadow-neon-lime">
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft/80 to-transparent" />
        <span className="relative font-display text-[15px] font-bold tracking-tighter text-paper">
          D<span className="bg-gradient-to-b from-accent-soft to-teal bg-clip-text text-transparent">↓</span>
        </span>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[13px] font-bold tracking-[0.08em] text-white">
            DOMAIN <span className="bg-gradient-to-r from-accent-soft to-teal bg-clip-text text-transparent">DROP</span>
          </span>
          <span className="mt-1 text-[7px] font-semibold tracking-[0.24em] text-white/40">
            DROP &amp; COLLECT
          </span>
        </span>
      )}
    </Link>
  );
}
