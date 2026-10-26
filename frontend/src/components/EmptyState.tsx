import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-8 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/35">
        <Icon size={22} />
      </div>
      <h3 className="font-display text-[15px] font-semibold text-white/85">{title}</h3>
      {description && <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-white/35">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
