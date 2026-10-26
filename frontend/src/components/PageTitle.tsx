import type { ReactNode } from 'react';

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-neon-lime/70">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[26px] font-bold leading-none tracking-tight text-white">
          {title}
        </h1>
        {description && <p className="mt-2 text-xs leading-relaxed text-white/38">{description}</p>}
      </div>
      {action}
    </div>
  );
}
