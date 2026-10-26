import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">{children}</h2>
      {action}
    </div>
  );
}
