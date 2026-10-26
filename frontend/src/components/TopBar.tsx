import { Link } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { cn, formatNumber } from '@/lib/utils';
import { Coin } from '@/components/Coin';
import { Logo } from '@/components/Logo';

export function TopBar() {
  const { me } = useAuth();
  const { enabled, toggle } = useSound();

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-white/[0.06] bg-ink-950/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[62px] w-full max-w-md items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={enabled ? 'Выключить звук' : 'Включить звук'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-white/45 transition hover:text-white active:scale-95"
            >
              {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <Link
              to="/"
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-xl border border-neon-lime/20 bg-neon-lime/[0.07] px-2.5',
                'transition hover:border-neon-lime/40 active:scale-95',
              )}
            >
              <Coin size={16} />
              <span className="font-display text-[13px] font-bold tabular-nums text-[#dfff9e]">
                {me ? formatNumber(me.user.balance) : '—'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
