import { useState } from 'react';
import { cn, initials } from '@/lib/utils';

const GRADIENTS = [
  'from-[#39e8ff] via-[#6366f1] to-[#8b5cff]',
  'from-[#b6ff3b] via-[#22c55e] to-[#0ea5e9]',
  'from-[#ff8a1f] via-[#f43f5e] to-[#8b5cff]',
  'from-[#ff3d55] via-[#f97316] to-[#facc15]',
  'from-[#a855f7] via-[#3b82f6] to-[#39e8ff]',
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  glow?: boolean;
}

export function Avatar({ src, name, size = 48, className, glow = false }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn(
        'relative shrink-0 rounded-full p-[1.5px]',
        glow
          ? 'bg-gradient-to-br from-neon-lime/80 via-neon-cyan/60 to-neon-violet/80 shadow-[0_0_24px_rgba(182,255,59,.18)]'
          : 'bg-white/15',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-display font-bold text-ink-950',
          gradientFor(name),
        )}
      >
        {showImage ? (
          <img
            src={src ?? ''}
            alt={name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span style={{ fontSize: Math.max(12, size * 0.34) }}>{initials(name) || 'DZ'}</span>
        )}
      </div>
    </div>
  );
}
