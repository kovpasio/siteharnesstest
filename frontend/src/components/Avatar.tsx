import { useState } from 'react';
import { cn, initials } from '@/lib/utils';

const GRADIENTS = [
  'from-[#7FA6C9] via-[#6C8EBF] to-[#8E6BB5]',
  'from-[#8EACCF] via-[#5B8FB9] to-[#4C6C97]',
  'from-[#C9884A] via-[#B98960] to-[#8E6BB5]',
  'from-[#B5545B] via-[#A98069] to-[#C9A45C]',
  'from-[#9A8BB5] via-[#6C8EBF] to-[#7FA6C9]',
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
