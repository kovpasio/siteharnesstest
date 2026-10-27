import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Coins, HandCoins, Sparkles } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { Coin } from '@/components/Coin';
import { PageTitle } from '@/components/PageTitle';
import { formatNumber, hapticImpact, hapticNotify, plural } from '@/lib/utils';

export function EarningsPage() {
  const { me, incrementBalance } = useAuth();
  const { toast } = useToast();
  const { playCoin } = useSound();
  const [clicks, setClicks] = useState(0);
  const [earned, setEarned] = useState(0);

  if (!me) return null;

  function click() {
    incrementBalance(1);
    setClicks((value) => value + 1);
    setEarned((value) => value + 1);
    hapticImpact('light');
    playCoin();

    void api.earnClick().catch(() => {
      incrementBalance(-1);
      setEarned((value) => Math.max(0, value - 1));
      hapticNotify('error');
      toast('Монета не зачислилась. Попробуйте ещё раз.', 'error');
    });
  }

  return (
    <div>
      <PageTitle
        eyebrow="earn coins"
        title="Заработок"
        description="Один клик — одна виртуальная монета. Без лимитов и кулдаунов."
      />

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/[0.12] to-ink-800 p-3.5">
          <div className="label mb-1.5">Баланс</div>
          <div className="flex items-center gap-1.5">
            <Coin size={17} />
            <span className="font-display text-xl font-semibold tracking-tight text-paper">
              {formatNumber(me.user.balance)}
            </span>
            <span className="text-[9px] font-semibold text-muted">D</span>
          </div>
        </div>
        <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.12] to-ink-800 p-3.5">
          <div className="label mb-1.5">За сеанс</div>
          <div className="font-display text-xl font-semibold text-paper">+{formatNumber(earned)}</div>
          <div className="mt-0.5 text-[8px] text-muted/60">
            {clicks} {plural(clicks, 'клик', 'клика', 'кликов')}
          </div>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-[#2C261B] via-ink-800 to-ink-800 p-5 shadow-card">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-teal/10 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <div className="mb-1 flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.08] px-2.5 py-1 text-[7px] font-bold uppercase tracking-[0.18em] text-gold">
            <Sparkles size={10} /> free coins
          </div>
          <h2 className="font-display text-[18px] font-semibold text-paper">Монетный пресс</h2>
          <p className="mt-1 text-center text-[9px] leading-relaxed text-muted">
            Нажимайте на монету внизу. Каждое нажатие добавляет ровно один D.
          </p>

          <div className="relative mt-5 flex h-[190px] w-[190px] items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border border-dashed border-gold/20"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <span
                  key={index}
                  className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-gold/50"
                  style={{ transform: `rotate(${index * 45}deg) translateY(-2px)` }}
                />
              ))}
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute h-[164px] w-[164px] rounded-full bg-gold/10 blur-xl"
            />

            <motion.button
              type="button"
              onClick={click}
              whileTap={{ scale: 0.94 }}
              aria-label="Получить 1 монету"
              className="relative flex h-[156px] w-[156px] flex-col items-center justify-center rounded-full border border-[#FFE1A3]/80 bg-gradient-to-br from-[#FFE3A8] via-[#F2A54A] to-[#C9772A] text-[#3A2408] shadow-[0_18px_45px_-18px_rgba(242,165,74,.75)]"
            >
              <span className="absolute inset-2 rounded-full border border-[#7C4A16]/25" />
              <HandCoins size={30} strokeWidth={2.1} />
              <span className="mt-1 font-display text-[23px] font-bold leading-none">+1 D</span>
              <span className="mt-1.5 text-[7px] font-bold uppercase tracking-[0.18em] opacity-65">
                нажми
              </span>

              <AnimatePresence>
                {clicks > 0 && (
                  <motion.span
                    key={clicks}
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: -56, scale: 1 }}
                    exit={{ opacity: 0, y: -70 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-gold/40 bg-ink-900 px-2 py-0.5 font-display text-[11px] font-bold text-gold"
                  >
                    +1
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[8px] text-muted/70">
            <Coins size={12} className="text-gold" />
            За сеанс: {formatNumber(earned)} D · {clicks} кликов
          </div>

          <Link
            to="/roulette"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[10px] font-semibold text-paper transition hover:border-accent/35 hover:bg-accent/[0.06]"
          >
            Потратить монеты в рулетке <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      <p className="mt-3 rounded-xl border border-white/[0.05] bg-ink-800/50 px-3.5 py-3 text-[8px] leading-relaxed text-muted/70">
        Монеты существуют только внутри Domain Drop и не имеют реальной стоимости. Это
        бесконечный демо-заработок без ограничений по времени.
      </p>
    </div>
  );
}
