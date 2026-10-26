import type { Rarity } from '@/types';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return formatNumber(value);
}

export function timeAgo(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const seconds = Math.floor(delta / 1000);
  if (seconds < 10) return 'только что';
  if (seconds < 60) return `${seconds} сек назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export function countdown(iso: string | null): string {
  if (!iso) return 'доступно';
  const delta = new Date(iso).getTime() - Date.now();
  if (delta <= 0) return 'доступно';
  const total = Math.ceil(delta / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}ч ${String(minutes).padStart(2, '0')}м`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY: Record<
  Rarity,
  {
    label: string;
    color: string;
    glow: string;
    gradient: string;
    soft: string;
    border: string;
    text: string;
    icon: string;
  }
> = {
  common: {
    label: 'Common',
    color: '#8b95a7',
    glow: 'rgba(139,149,167,.45)',
    gradient: 'from-[#8b95a7]/20 via-[#8b95a7]/5 to-transparent',
    soft: 'bg-[#8b95a7]/10',
    border: 'border-[#8b95a7]/30',
    text: 'text-[#aab3c2]',
    icon: '◇',
  },
  rare: {
    label: 'Rare',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,.55)',
    gradient: 'from-[#3b82f6]/25 via-[#3b82f6]/5 to-transparent',
    soft: 'bg-[#3b82f6]/10',
    border: 'border-[#3b82f6]/35',
    text: 'text-[#6ca6ff]',
    icon: '◈',
  },
  epic: {
    label: 'Epic',
    color: '#a855f7',
    glow: 'rgba(168,85,247,.6)',
    gradient: 'from-[#a855f7]/25 via-[#a855f7]/5 to-transparent',
    soft: 'bg-[#a855f7]/10',
    border: 'border-[#a855f7]/40',
    text: 'text-[#c084fc]',
    icon: '✦',
  },
  legendary: {
    label: 'Legendary',
    color: '#ff8a1f',
    glow: 'rgba(255,138,31,.7)',
    gradient: 'from-[#ff8a1f]/30 via-[#ff8a1f]/8 to-transparent',
    soft: 'bg-[#ff8a1f]/10',
    border: 'border-[#ff8a1f]/45',
    text: 'text-[#ffb15c]',
    icon: '★',
  },
  mythic: {
    label: 'Mythic',
    color: '#ff3d55',
    glow: 'rgba(255,61,85,.8)',
    gradient: 'from-[#ff3d55]/30 via-[#ff3d55]/10 to-transparent',
    soft: 'bg-[#ff3d55]/10',
    border: 'border-[#ff3d55]/50',
    text: 'text-[#ff7182]',
    icon: '☄',
  },
};

export const ZONE_META: Record<string, { label: string; className: string }> = {
  '.ru': { label: 'RU', className: 'text-[#7dd3fc] bg-[#0ea5e9]/10 border-[#0ea5e9]/20' },
  '.com': { label: 'COM', className: 'text-[#c4b5fd] bg-[#8b5cf6]/10 border-[#8b5cf6]/20' },
  '.io': { label: 'IO', className: 'text-[#bef264] bg-[#84cc16]/10 border-[#84cc16]/20' },
};

export function getTelegram() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') {
  getTelegram()?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type: 'error' | 'success' | 'warning') {
  getTelegram()?.HapticFeedback?.notificationOccurred(type);
}

export function hapticSelection() {
  getTelegram()?.HapticFeedback?.selectionChanged();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function shortHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
