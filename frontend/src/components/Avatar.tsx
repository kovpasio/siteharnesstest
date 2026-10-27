import { useState } from 'react';
import { cn, initials } from '@/lib/utils';

const GRADIENTS = [
  'from-[#5FB3FF] via-[#4F9DFF] to-[#B07CFF]',
  'from-[#43D6C5] via-[#4D9BFF] to-[#2B6CCB]',
  'from-[#F2A54A] via-[#F06473] to-[#B07CFF]',
  'from-[#F06473] via-[#F2A54A] to-[#FFD27A]',
  'from-[#B07CFF] via-[#4F9DFF] to-[#43D6C5]',
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
          ? 'bg-gradient-to-br from-accent-soft/80 via-accent/60 to-rarity-epic/70'
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
