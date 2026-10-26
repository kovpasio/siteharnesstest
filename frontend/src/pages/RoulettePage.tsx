import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Copy,
  Dices,
  Fingerprint,
  LockKeyhole,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ApiError, api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { DropFlash } from '@/components/DropFlash';
import { PityMeter } from '@/components/PityMeter';
import { RarityBadge } from '@/components/RarityBadge';
import { SectionTitle } from '@/components/SectionTitle';
import type { Commitment, Domain, Rarity, SpinResult } from '@/types';
import {
  cn,
  copyText,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
  RARITY_ORDER,
  shortHash,
} from '@/lib/utils';

const ITEM_WIDTH = 126;
const ITEM_GAP = 10;
const ITEM_STEP = ITEM_WIDTH + ITEM_GAP;
const TARGET_INDEX = 38;
const RIBBON_LENGTH = 48;
const SPIN_DURATION = 4.6;

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 6000,
  rare: 2500,
  epic: 1000,
  legendary: 450,
  mythic: 50,
};

function randomDomain(domains: Domain[]): Domain {
  const roll = Math.random() * 10_000;
  let cursor = 0;
  let rarity: Rarity = 'common';
  for (const key of RARITY_ORDER) {
    cursor += RARITY_WEIGHTS[key];
    if (roll < cursor) {
      rarity = key;
      break;
    }
  }
  const bucket = domains.filter((domain) => domain.rarity === rarity);
  const pool = bucket.length ? bucket : domains;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function RoulettePage() {
  const { me, refresh, applyBalance } = useAuth();
  const { toast } = useToast();
  const { playTick, playReveal } = useSound();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [ribbon, setRibbon] = useState<Domain[]>([]);
  const [ribbonId, setRibbonId] = useState(0);
  const [animateTarget, setAnimateTarget] = useState(0);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [prepareError, setPrepareError] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<Rarity | null>(null);
  const [fairOpen, setFairOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const tickTimers = useRef<number[]>([]);
  const flashTimer = useRef<number | null>(null);
  const spinLock = useRef(false);

  const clearTickTimers = useCallback(() => {
    tickTimers.current.forEach((timer) => window.clearTimeout(timer));
    tickTimers.current = [];
  }, []);

  const prepareNext = useCallback(async () => {
    setPreparing(true);
    setPrepareError(false);
    try {
      const next = await api.prepareSpin();
      setCommitment(next);
    } catch (error) {
      setPrepareError(true);
      const message = error instanceof Error ? error.message : 'Не удалось подготовить спин';
      toast(message, 'error');
    } finally {
      setPreparing(false);
    }
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    void api
      .domains()
      .then((data) => {
        if (!mounted) return;
        setDomains(data);
        if (data.length > 0) {
          setRibbon(Array.from({ length: RIBBON_LENGTH }, () => randomDomain(data)));
        }
      })
      .catch(() => {
        if (mounted) toast('Не удалось загрузить каталог доменов', 'error');
      });
    void prepareNext();

    return () => {
      mounted = false;
      clearTickTimers();
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [prepareNext, toast, clearTickTimers]);

  const scheduleTicks = useCallback(() => {
    clearTickTimers();
    let elapsed = 0;
    let gap = 65;
    while (elapsed < SPIN_DURATION * 1000 - 150) {
      const delay = elapsed;
      tickTimers.current.push(window.setTimeout(() => playTick(), delay));
      elapsed += gap;
      gap = Math.min(420, gap * 1.075);
    }
  }, [clearTickTimers, playTick]);

  const handleAnimationComplete = useCallback(() => {
    if (!spinLock.current || !result) return;
    spinLock.current = false;
    setSpinning(false);
    setRevealed(true);
    playReveal(result.rarity);
    hapticNotify('success');

    if (result.rarity === 'legendary' || result.rarity === 'mythic') {
      setFlash(result.rarity);
      hapticImpact('heavy');
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 1500);
    } else {
      hapticImpact('medium');
    }
    void refresh().catch(() => undefined);
  }, [result, playReveal, refresh]);

  async function handleSpin() {
    if (!me || spinLock.current || spinning || !commitment || preparing) return;
    if (me.user.balance < me.stats.spin_cost) {
      toast('Недостаточно монет. Заберите ежедневный бонус в профиле.', 'error');
      return;
    }

    spinLock.current = true;
    setSpinning(true);
    setRevealed(false);
    setResult(null);
    setFlash(null);
    setFairOpen(false);
    hapticImpact('medium');

    try {
      const spin = await api.spin(commitment.commitment_id);
      applyBalance(spin.balance);
      setCommitment(null);
      setPreparing(true);

      const width = viewportRef.current?.offsetWidth ?? 360;
      const target = width / 2 - (TARGET_INDEX * ITEM_STEP + ITEM_WIDTH / 2);

      const nextRibbon = Array.from({ length: RIBBON_LENGTH }, (_, index) =>
        index === TARGET_INDEX ? spin.domain : randomDomain(domains),
      );

      setResult(spin);
      setRibbon(nextRibbon);
      setAnimateTarget(target);
      setRibbonId((value) => value + 1);
      scheduleTicks();
      void prepareNext();
      void refresh().catch(() => undefined);
    } catch (error) {
      spinLock.current = false;
      setSpinning(false);
      const message = error instanceof Error ? error.message : 'Спин не удался';
      toast(message, 'error');
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        void prepareNext();
      }
    }
  }

  async function copy(value: string, label: string) {
    const ok = await copyText(value);
    toast(ok ? `${label} скопирован` : 'Не удалось скопировать', ok ? 'success' : 'error');
  }

  if (!me) return null;
  const { user, stats } = me;
  const canAfford = user.balance >= stats.spin_cost;
  const spinDisabled = spinning || preparing || !commitment || !canAfford || domains.length === 0;
  const buttonLabel = spinning
    ? 'Крутим…'
    : !canAfford
      ? 'Недостаточно монет'
      : preparing || !commitment
        ? 'Подготовка…'
        : revealed
          ? `Крутить ещё · ${stats.spin_cost} D`
          : `Крутить · ${stats.spin_cost} D`;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-neon-lime/70">
            live drop engine
          </div>
          <h1 className="font-display text-[28px] font-bold leading-none tracking-tight text-white">
            Рулетка
          </h1>
          <p className="mt-2 text-xs text-white/35">
            {stats.spin_cost} D за спин · шанс Mythic 1 к 200
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-right">
          <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/28">Спинов</div>
          <div className="mt-0.5 font-display text-base font-bold text-white/85">{user.total_spins}</div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-ink-800/80 p-2 shadow-card">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-neon-lime/45 to-transparent" />
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-lime opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-lime" />
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/35">
              drop feed
            </span>
          </div>
          <div className="flex items-center gap-1 text-[8px] font-semibold text-white/25">
            <Zap size={9} className="text-rarity-legendary" />
            provably fair
          </div>
        </div>

        <div
          ref={viewportRef}
          className="roulette-fade relative h-[174px] overflow-hidden rounded-[22px] border border-white/[0.05] bg-[#06070c]"
        >
          <div className="absolute inset-x-0 top-0 z-10 flex h-4 items-end justify-between px-3 opacity-30">
            {Array.from({ length: 28 }).map((_, index) => (
              <span
                key={index}
                className={cn('w-px bg-white', index % 4 === 0 ? 'h-2' : 'h-1')}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex h-4 items-start justify-between px-3 opacity-30">
            {Array.from({ length: 28 }).map((_, index) => (
              <span
                key={index}
                className={cn('w-px bg-white', index % 4 === 0 ? 'h-2' : 'h-1')}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center">
            <motion.div
              key={ribbonId}
              initial={{ x: 0 }}
              animate={{ x: animateTarget }}
              transition={{ duration: SPIN_DURATION, ease: [0.08, 0.72, 0.1, 1] }}
              onAnimationComplete={handleAnimationComplete}
              className="flex w-max gap-2.5 will-change-transform"
            >
              {ribbon.map((domain, index) => (
                <RibbonCard
                  key={`${ribbonId}-${index}-${domain.id}`}
                  domain={domain}
                  highlighted={revealed && index === TARGET_INDEX}
                />
              ))}
            </motion.div>
          </div>

          <div className="roulette-vignette pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
            <div className="h-full w-px bg-gradient-to-b from-neon-lime/0 via-neon-lime/80 to-neon-lime/0 shadow-[0_0_16px_rgba(182,255,59,.65)]" />
            <div className="absolute -top-0.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-neon-lime" />
            <div className="absolute -bottom-0.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[7px] border-x-transparent border-b-neon-lime" />
          </div>
        </div>

        {result && !revealed && spinning && (
          <div className="absolute inset-x-0 bottom-2 z-30 flex justify-center">
            <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[9px] font-semibold text-white/45 backdrop-blur">
              сканируем зону…
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {RARITY_ORDER.map((rarity) => {
          const meta = RARITY[rarity];
          return (
            <div
              key={rarity}
              className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.05] bg-white/[0.02] py-2"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color, boxShadow: `0 0 7px ${meta.color}` }}
              />
              <span className="text-[8px] font-bold uppercase tracking-[0.08em]" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSpin}
        disabled={spinDisabled}
        className={cn(
          'group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[20px] py-4 font-display text-[15px] font-bold transition active:scale-[0.985]',
          spinDisabled
            ? 'cursor-not-allowed border border-white/[0.07] bg-white/[0.04] text-white/25'
            : 'bg-gradient-to-r from-[#cfff7a] via-neon-lime to-[#a8ef32] text-ink-950 shadow-[0_12px_45px_-10px_rgba(182,255,59,.55)]',
        )}
      >
        {spinning ? <RotateCw size={18} className="animate-spin" /> : <Dices size={19} />}
        {buttonLabel}
        {!spinDisabled && (
          <span className="absolute inset-0 shine bg-[length:200%_100%] opacity-20 animate-shimmer" />
        )}
      </button>

      {!canAfford && (
        <Link
          to="/"
          className="flex items-center justify-between rounded-2xl border border-rarity-legendary/20 bg-rarity-legendary/[0.06] px-4 py-3 text-[11px] text-rarity-legendary"
        >
          <span>Закончились монеты — заберите бонус или продайте домен</span>
          <ArrowRight size={14} />
        </Link>
      )}

      {prepareError && !preparing && (
        <button
          type="button"
          onClick={() => void prepareNext()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rarity-mythic/25 bg-rarity-mythic/[0.06] py-3 text-[11px] font-semibold text-rarity-mythic"
        >
          <RotateCw size={13} /> Повторить подготовку commitment
        </button>
      )}

      <PityMeter counter={stats.pity_counter} threshold={stats.pity_threshold} />

      <AnimatePresence>
        {revealed && result && (
          <motion.section
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="relative overflow-hidden rounded-[26px] border bg-ink-800/90 p-5"
            style={{ borderColor: `${RARITY[result.rarity].color}55` }}
          >
            <div
              className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full blur-[60px]"
              style={{ background: RARITY[result.rarity].glow }}
            />
            <div className="relative flex items-center justify-between">
              <span className="label">Дроп зафиксирован</span>
              {result.pity_applied && (
                <span className="rounded-full border border-rarity-epic/30 bg-rarity-epic/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-rarity-epic">
                  pity сработал
                </span>
              )}
            </div>

            <div className="relative mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <RarityBadge rarity={result.rarity} />
                  <span className="text-[9px] font-semibold text-white/25">#{result.id}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-0.5 font-display text-[35px] font-bold leading-none tracking-tight text-white">
                  <span className="truncate">{result.domain.name}</span>
                  <span style={{ color: RARITY[result.rarity].color }}>{result.domain.zone}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[9px] uppercase tracking-[0.14em] text-white/30">sell</div>
                <div className="font-display text-xl font-bold text-neon-lime">
                  +{formatNumber(result.price)}
                </div>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <Link
                to={`/verify?spin=${result.id}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[11px] font-semibold text-white/70 transition active:scale-95"
              >
                <ShieldCheck size={13} /> Проверить
              </Link>
              <Link
                to="/inventory"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neon-lime/25 bg-neon-lime/[0.08] py-2.5 text-[11px] font-semibold text-neon-lime transition active:scale-95"
              >
                <Sparkles size={13} /> В инвентарь
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setFairOpen((value) => !value)}
              className="relative mt-3 flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-[10px] text-white/30"
            >
              <span className="flex items-center gap-1.5">
                <Fingerprint size={12} /> Данные проверки
              </span>
              <span>{fairOpen ? 'скрыть' : 'показать'}</span>
            </button>

            <AnimatePresence initial={false}>
              {fairOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="relative overflow-hidden"
                >
                  <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/25 p-3">
                    <FairRow
                      label="server_seed"
                      value={result.server_seed}
                      onCopy={() => void copy(result.server_seed, 'server_seed')}
                    />
                    <FairRow
                      label="sha256"
                      value={result.server_seed_hash}
                      onCopy={() => void copy(result.server_seed_hash, 'sha256')}
                    />
                    <FairRow
                      label="client:nonce"
                      value={`${result.client_seed}:${result.nonce}`}
                      onCopy={() =>
                        void copy(`${result.client_seed}:${result.nonce}`, 'client_seed:nonce')
                      }
                    />
                    <div className="flex justify-between border-t border-white/[0.05] pt-2 text-[9px] text-white/30">
                      <span>rarityRoll {result.rarity_roll}</span>
                      <span>
                        domainIndex {result.domain_index}/{result.bucket_size}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.022] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/38">
            <LockKeyhole size={12} className="text-neon-lime/70" />
            Commitment следующего спина
          </div>
          <span className="text-[8px] uppercase tracking-[0.14em] text-white/20">sha-256</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/45">
            {commitment?.server_seed_hash ?? 'генерируется…'}
          </code>
          {commitment && (
            <button
              type="button"
              onClick={() => void copy(commitment.server_seed_hash, 'Commitment')}
              className="text-white/25 transition hover:text-white/60"
              aria-label="Скопировать commitment"
            >
              <Copy size={12} />
            </button>
          )}
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-white/22">
          Сервер публикует хеш до спина. После результата server_seed раскрывается — его можно
          проверить в разделе «Честность».
        </p>
      </div>

      <SectionTitle>Шансы и выплаты</SectionTitle>
      <div className="grid grid-cols-1 gap-1.5">
        {RARITY_ORDER.map((rarity) => (
          <div
            key={rarity}
            className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: RARITY[rarity].color, boxShadow: `0 0 6px ${RARITY[rarity].color}` }}
              />
              <span className="text-[10px] font-semibold" style={{ color: RARITY[rarity].color }}>
                {RARITY[rarity].label}
              </span>
              <span className="text-[9px] text-white/22">{RARITY[rarity].label === 'Common' ? '60%' : rarity === 'rare' ? '25%' : rarity === 'epic' ? '10%' : rarity === 'legendary' ? '4.5%' : '0.5%'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-white/25">продажа</span>
              <span className="font-display text-[12px] font-bold text-white/70">
                {rarity === 'common' ? 5 : rarity === 'rare' ? 20 : rarity === 'epic' ? 60 : rarity === 'legendary' ? 300 : 1500} D
              </span>
            </div>
          </div>
        ))}
      </div>

      <DropFlash rarity={flash} />
    </div>
  );
}

function RibbonCard({ domain, highlighted }: { domain: Domain; highlighted: boolean }) {
  const meta = RARITY[domain.rarity];
  return (
    <div
      className={cn(
        'relative flex h-[150px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border p-3 transition',
        highlighted && 'ring-1',
      )}
      style={{
        width: ITEM_WIDTH,
        borderColor: highlighted ? meta.color : `${meta.color}45`,
        background: `linear-gradient(155deg, ${meta.color}26 0%, rgba(13,16,26,.97) 48%, rgba(8,10,17,.98) 100%)`,
        boxShadow: highlighted ? `0 0 32px ${meta.glow}` : `inset 0 1px 0 rgba(255,255,255,.05)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="text-[13px] leading-none" style={{ color: meta.color }}>
          {meta.icon}
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-[16px] font-bold leading-tight tracking-tight text-white">
          {domain.name}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: meta.color }}>
          {domain.zone}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
        <span className="text-[8px] uppercase tracking-[0.1em] text-white/22">value</span>
        <span className="font-display text-[11px] font-bold text-white/60">{domain.price} D</span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
      />
    </div>
  );
}

function FairRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/25">{label}</span>
        <button type="button" onClick={onCopy} className="text-white/25 transition hover:text-white/60">
          <Copy size={10} />
        </button>
      </div>
      <code className="block break-all font-mono text-[9px] leading-relaxed text-white/45">
        {shortHash(value, 20, 12)}
      </code>
    </div>
  );
}
