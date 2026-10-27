import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HandCoins, Sparkles } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { PageTitle } from '@/components/PageTitle';
import { hapticImpact, hapticNotify } from '@/lib/utils';

interface Burst {
  id: number;
  amount: number;
}

export function EarningsPage() {
  const { incrementBalance } = useAuth();
  const { toast } = useToast();
  const { playCoin } = useSound();
  const [burst, setBurst] = useState<Burst | null>(null);

  const holding = useRef(false);
  const pressStartedAt = useRef(0);
  const holdDelay = useRef<number | null>(null);
  const holdInterval = useRef<number | null>(null);
  const burstTimer = useRef<number | null>(null);
  const burstId = useRef(0);

  const clearHoldTimers = () => {
    if (holdDelay.current !== null) {
      window.clearTimeout(holdDelay.current);
      holdDelay.current = null;
    }
    if (holdInterval.current !== null) {
      window.clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  };

  const clearBurstTimer = () => {
    if (burstTimer.current !== null) {
      window.clearTimeout(burstTimer.current);
      burstTimer.current = null;
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      clearHoldTimers();
      clearBurstTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function award(amount: number) {
    incrementBalance(amount);
    burstId.current += 1;
    setBurst({ id: burstId.current, amount });
    clearBurstTimer();
    burstTimer.current = window.setTimeout(() => setBurst(null), 900);
    hapticImpact('light');
    playCoin();

    const request = amount === 5 ? api.earnHold() : api.earnClick();
    void request.catch(() => {
      incrementBalance(-amount);
      hapticNotify('error');
      toast('Монета не зачислилась. Попробуйте ещё раз.', 'error');
    });
  }

  function startHold(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (holding.current) return;
    holding.current = true;
    pressStartedAt.current = Date.now();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    holdDelay.current = window.setTimeout(() => {
      if (!holding.current) return;
      award(5);
      holdInterval.current = window.setInterval(() => {
        if (holding.current) award(5);
      }, 1000);
    }, 300);
  }

  function endHold(allowTap: boolean) {
    if (!holding.current) return;
    const elapsed = Date.now() - pressStartedAt.current;
    holding.current = false;
    clearHoldTimers();
    if (allowTap && elapsed < 300) award(1);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitle
        eyebrow="earn coins"
        title="Заработок"
        description="Удерживайте монету — каждую секунду начисляется 5 монет. Короткое нажатие даёт 1."
      />

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-[#2C261B] via-ink-800 to-ink-800 p-4 shadow-card">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-teal/10 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <div className="mb-1 flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.08] px-2.5 py-1 text-[7px] font-bold uppercase tracking-[0.18em] text-gold">
            <Sparkles size={10} /> free coins
          </div>
          <h2 className="font-display text-[18px] font-semibold text-paper">Монетный пресс</h2>
          <p className="mt-1 text-center text-[9px] leading-relaxed text-muted">
            Нажмите и удерживайте. Пока палец на кнопке — монеты капают каждую секунду.
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            className="absolute h-[190px] w-[190px] rounded-full border border-dashed border-gold/20"
          />
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute h-[164px] w-[164px] rounded-full bg-gold/10 blur-xl"
          />

          <motion.button
            type="button"
            onPointerDown={startHold}
            onPointerUp={() => endHold(true)}
            onPointerCancel={() => endHold(false)}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            whileTap={{ scale: 0.94 }}
            aria-label="Удерживать для заработка"
            className="relative flex h-[156px] w-[156px] touch-none select-none flex-col items-center justify-center rounded-full border border-[#FFE1A3]/80 bg-gradient-to-br from-[#FFE3A8] via-[#F2A54A] to-[#C9772A] text-[#3A2408] shadow-[0_18px_45px_-18px_rgba(242,165,74,.75)]"
          >
            <span className="absolute inset-2 rounded-full border border-[#7C4A16]/25" />
            <HandCoins size={30} strokeWidth={2.1} />
            <span className="mt-1 font-display text-[23px] font-bold leading-none">+5 D</span>
            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] opacity-65">
              в секунду
            </span>
            <span className="mt-1 text-[7px] font-semibold uppercase tracking-[0.12em] opacity-45">
              удерживай
            </span>

            <AnimatePresence>
              {burst && (
                <motion.span
                  key={burst.id}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: -60, scale: 1 }}
                  exit={{ opacity: 0, y: -72 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-gold/40 bg-ink-900 px-2 py-0.5 font-display text-[11px] font-bold text-gold"
                >
                  +{burst.amount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <p className="relative mt-2 text-center text-[8px] text-muted/60">
          Короткое нажатие — +1 D · удержание — +5 D каждую секунду
        </p>
      </section>
    </div>
  );
}
