import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ChevronRight,
  Coins,
  Gift,
  Layers,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { Avatar } from '@/components/Avatar';
import { Coin } from '@/components/Coin';
import { PityMeter } from '@/components/PityMeter';
import { SectionTitle } from '@/components/SectionTitle';
import { StatTile } from '@/components/StatTile';
import {
  cn,
  countdown,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
  RARITY_ORDER,
  timeAgo,
} from '@/lib/utils';
import { ApiError } from '@/api/client';

export function ProfilePage() {
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin } = useSound();
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!me) return null;
  const { user, stats } = me;
  const nextAvailable = stats.daily_available_at ? new Date(stats.daily_available_at).getTime() : 0;
  const dailyReady = nextAvailable <= now;
  const maxCount = Math.max(1, ...RARITY_ORDER.map((rarity) => stats.collection_by_rarity?.[rarity] ?? 0));

  async function claimDaily() {
    if (!dailyReady || claiming) return;
    setClaiming(true);
    hapticImpact('medium');
    try {
      const result = await api.dailyBonus();
      playCoin();
      hapticNotify('success');
      toast(`Ежедневный бонус +${result.amount} D`, 'success');
      await refresh();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Не удалось получить бонус';
      toast(message, 'error');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-ink-800/70 p-5 shadow-card"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-neon-violet/20 blur-[70px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-neon-lime/10 blur-[60px]" />
        <div className="noise pointer-events-none absolute inset-0 opacity-[0.035]" />

        <div className="relative flex items-start gap-4">
          <div className="relative">
            <Avatar
              src={user.avatar_url}
              name={user.display_name}
              size={76}
              glow
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-ink-800 bg-neon-lime">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-950" />
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full border border-neon-lime/25 bg-neon-lime/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-neon-lime">
                pilot
              </span>
              {stats.rank && (
                <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/55">
                  <Trophy size={9} />
                  #{stats.rank}
                </span>
              )}
            </div>
            <h1 className="truncate font-display text-[22px] font-bold leading-tight tracking-tight text-white">
              {user.display_name}
            </h1>
            <p className="mt-0.5 truncate text-xs text-white/35">
              {user.username ? `@${user.username}` : 'anonymous pilot'}
            </p>
            <p className="mt-2 text-[10px] text-white/25">
              В системе {timeAgo(user.created_at)} · {user.total_spins} спинов
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex items-end justify-between rounded-2xl border border-white/[0.07] bg-black/20 p-4">
          <div>
            <div className="label mb-2">Баланс</div>
            <div className="flex items-center gap-2.5">
              <Coin size={26} />
              <span className="font-display text-[34px] font-bold leading-none tracking-tight text-white">
                {formatNumber(user.balance)}
              </span>
              <span className="mb-1 text-[10px] font-bold text-white/25">D</span>
            </div>
          </div>
          <Link
            to="/roulette"
            onClick={() => hapticImpact('light')}
            className="flex items-center gap-1.5 rounded-xl border border-neon-lime/30 bg-neon-lime/[0.09] px-3 py-2.5 text-[11px] font-bold text-neon-lime transition active:scale-95"
          >
            Крутить
            <ArrowUpRight size={13} />
          </Link>
        </div>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <StatTile
            icon={Layers}
            label="Домены"
            value={formatNumber(stats.collection_count)}
            hint="в коллекции"
          />
          <StatTile
            icon={Coins}
            label="Сумма"
            value={formatNumber(stats.collection_value)}
            hint="монет"
            accent="#b6ff3b"
          />
          <StatTile
            icon={Trophy}
            label="Место"
            value={stats.rank ? `#${stats.rank}` : '—'}
            hint={`из ${stats.total_players}`}
            accent="#ff8a1f"
          />
        </div>
      </motion.section>

      <button
        type="button"
        onClick={claimDaily}
        disabled={!dailyReady || claiming}
        className={cn(
          'group relative w-full overflow-hidden rounded-[22px] border p-4 text-left transition active:scale-[0.99]',
          dailyReady
            ? 'border-neon-lime/30 bg-gradient-to-r from-neon-lime/[0.13] via-neon-lime/[0.055] to-transparent'
            : 'border-white/[0.07] bg-white/[0.02]',
        )}
      >
        <div className="flex items-center gap-2.5 min-[360px]:gap-3.5">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
              dailyReady
                ? 'border-neon-lime/30 bg-neon-lime/15 text-neon-lime'
                : 'border-white/10 bg-white/[0.04] text-white/30',
            )}
          >
            <Gift size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-[12px] font-semibold text-white min-[360px]:text-[13px]">
                Ежедневный бонус
              </span>
              {dailyReady && (
                <span className="hidden rounded-full bg-neon-lime px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-ink-950 min-[360px]:inline">
                  ready
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-white/35">
              {dailyReady
                ? 'Заберите +100 D — хватит на два спина'
                : `Следующий через ${countdown(stats.daily_available_at)}`}
            </p>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'font-display text-[17px] font-bold',
                dailyReady ? 'text-neon-lime' : 'text-white/30',
              )}
            >
              {claiming ? '...' : '+100'}
            </div>
            <div className="mt-0.5 text-[9px] text-white/25">каждые 24ч</div>
          </div>
        </div>
        {dailyReady && (
          <div className="shine absolute inset-0 bg-[length:200%_100%] opacity-30 animate-shimmer" />
        )}
      </button>

      <PityMeter counter={stats.pity_counter} threshold={stats.pity_threshold} />

      <section>
        <SectionTitle
          action={
            <Link
              to="/inventory"
              className="flex items-center gap-0.5 text-[10px] font-semibold text-white/35 transition hover:text-white/70"
            >
              Вся коллекция <ChevronRight size={12} />
            </Link>
          }
        >
          Состав коллекции
        </SectionTitle>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-4">
          {stats.collection_count === 0 ? (
            <div className="flex flex-col items-center py-5 text-center">
              <Sparkles size={22} className="mb-2 text-white/20" />
              <p className="text-xs text-white/45">Коллекция пока пуста</p>
              <Link
                to="/roulette"
                className="mt-2 text-[10px] font-semibold text-neon-lime/80 underline decoration-neon-lime/30 underline-offset-4"
              >
                Сделать первый спин
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {RARITY_ORDER.map((rarity) => {
                const count = stats.collection_by_rarity?.[rarity] ?? 0;
                const meta = RARITY[rarity];
                return (
                  <div key={rarity} className="flex items-center gap-3">
                    <div className="w-[70px] shrink-0 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                      {meta.label}
                    </div>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxCount) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.05 }}
                        className="h-full rounded-full"
                        style={{
                          background: meta.color,
                          boxShadow: count > 0 ? `0 0 10px ${meta.glow}` : 'none',
                        }}
                      />
                    </div>
                    <div className="w-6 text-right font-display text-[11px] font-bold tabular-nums text-white/55">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Link
        to="/verify"
        className="flex items-center gap-3.5 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-neon-cyan/20 hover:bg-white/[0.04] active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/[0.07] text-neon-cyan">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[12px] font-semibold text-white">
            Проверить честность
          </div>
          <p className="mt-0.5 text-[10px] text-white/32">
            Provably Fair · SHA-256 + HMAC
          </p>
        </div>
        <ChevronRight size={16} className="text-white/25" />
      </Link>

      <div className="flex items-center justify-center gap-1.5 pb-1 text-[9px] text-white/18">
        <ShieldCheck size={10} />
        Все домены виртуальные. Реальных регистраций и денег нет.
      </div>
    </div>
  );
}
