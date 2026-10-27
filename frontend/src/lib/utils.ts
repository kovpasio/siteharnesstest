import type { Rarity } from '@/types';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.0', '')}B`;
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
    color: '#8A8F98',
    glow: 'rgba(138,143,152,.22)',
    gradient: 'from-[#8A8F98]/15 via-[#8A8F98]/4 to-transparent',
    soft: 'bg-[#8A8F98]/10',
    border: 'border-[#8A8F98]/25',
    text: 'text-[#B2B6BE]',
    icon: '◇',
  },
  rare: {
    label: 'Rare',
    color: '#5B8FB9',
    glow: 'rgba(91,143,185,.25)',
    gradient: 'from-[#5B8FB9]/18 via-[#5B8FB9]/4 to-transparent',
    soft: 'bg-[#5B8FB9]/10',
    border: 'border-[#5B8FB9]/30',
    text: 'text-[#82A9CB]',
    icon: '◈',
  },
  epic: {
    label: 'Epic',
    color: '#8E6BB5',
    glow: 'rgba(142,107,181,.26)',
    gradient: 'from-[#8E6BB5]/18 via-[#8E6BB5]/4 to-transparent',
    soft: 'bg-[#8E6BB5]/10',
    border: 'border-[#8E6BB5]/32',
    text: 'text-[#AD90CC]',
    icon: '✦',
  },
  legendary: {
    label: 'Legendary',
    color: '#C9884A',
    glow: 'rgba(201,136,74,.28)',
    gradient: 'from-[#C9884A]/18 via-[#C9884A]/4 to-transparent',
    soft: 'bg-[#C9884A]/10',
    border: 'border-[#C9884A]/35',
    text: 'text-[#D9A26C]',
    icon: '★',
  },
  mythic: {
    label: 'Mythic',
    color: '#B5545B',
    glow: 'rgba(181,84,91,.3)',
    gradient: 'from-[#B5545B]/18 via-[#B5545B]/5 to-transparent',
    soft: 'bg-[#B5545B]/10',
    border: 'border-[#B5545B]/38',
    text: 'text-[#CE7B81]',
    icon: '☄',
  },
};

export const ZONE_META: Record<string, { label: string; className: string }> = {
  '.ru': { label: 'RU', className: 'text-[#89A9C7] bg-[#5B8FB9]/10 border-[#5B8FB9]/20' },
  '.com': { label: 'COM', className: 'text-[#A88CC7] bg-[#8E6BB5]/10 border-[#8E6BB5]/20' },
  '.io': { label: 'IO', className: 'text-[#91B4A0] bg-[#6F9C82]/10 border-[#6F9C82]/20' },
  '.xyz': { label: 'XYZ', className: 'text-[#C2A17B] bg-[#A6805B]/10 border-[#A6805B]/20' },
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
