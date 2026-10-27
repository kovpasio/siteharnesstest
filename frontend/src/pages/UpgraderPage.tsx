import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CircleSlash2,
  Flame,
  Hammer,
  Loader2,
  PackageOpen,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { RarityBadge } from '@/components/RarityBadge';
import type { InventoryItem, Meta, UpgradeResult, UpgradeSector } from '@/types';
import { cn, formatNumber, hapticImpact, hapticNotify, RARITY } from '@/lib/utils';

const FALLBACK_SECTORS: UpgradeSector[] = [
  { sector: 10, multiplier: 9, ev: 0.9 },
  { sector: 25, multiplier: 3.75, ev: 0.9375 },
  { sector: 50, multiplier: 1.9, ev: 0.95 },
  { sector: 75, multiplier: 1.2, ev: 0.9 },
];

const SECTOR_COLORS = ['#4D9BFF', '#B07CFF', '#F2A54A', '#43D6C5'];

function landingAngle(chance: number, success: boolean): number {
  const filled = Math.min(358, Math.max(2, chance * 3.6));
  if (success) {
    const pad = Math.min(5, filled / 4);
    return pad + Math.random() * Math.max(1, filled - pad * 2);
  }
  const free = 360 - filled;
  const pad = Math.min(5, free / 4);
  return filled + pad + Math.random() * Math.max(1, free - pad * 2);
}

export function UpgraderPage() {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin, playReveal } = useSound();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sectorIndex, setSectorIndex] = useState(2);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forging, setForging] = useState(false);
  const [arrowAngle, setArrowAngle] = useState(0);
  const [result, setResult] = useState<UpgradeResult | null>(null);

  const sectors = meta?.upgrade_sectors?.length ? meta.upgrade_sectors : FALLBACK_SECTORS;
  const sector = sectors[Math.min(sectorIndex, sectors.length - 1)];
  const chanceRange = meta?.economy.upgrade_chance_ranges?.[String(sector.sector)] ?? [
    sector.sector,
    sector.sector + 0.99,
  ];

  async function loadInventory() {
    try {
      setItems(await api.inventory());
    } catch (error) {
      setItems([]);
      toast(error instanceof Error ? error.message : 'Не удалось загрузить инвентарь', 'error');
    }
  }

  useEffect(() => {
    void loadInventory();
    void api
      .meta()
      .then(setMeta)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItems = useMemo(
    () => (items ?? []).filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const sum = selectedItems.reduce((total, item) => total + item.domain.price, 0);
  const target = Math.round(sum * sector.multiplier);

  function toggle(id: number) {
    if (forging) return;
    hapticImpact('light');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 50) {
          toast('Можно выбрать не больше 50 доменов', 'error');
          return current;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function runUpgrade() {
    if (!selectedItems.length || forging) return;
    setConfirmOpen(false);
    setForging(true);
    setArrowAngle(0);
    setResult(null);
    hapticImpact('medium');
    try {
      const response = await api.upgrade(
        selectedItems.map((item) => item.id),
        sector.sector,
      );
      const finalAngle = landingAngle(sector.sector, response.success);
      setArrowAngle(1440 + finalAngle);
      // 2.2s spin + a short pause so the landed arrow is readable.
      await new Promise((resolve) => window.setTimeout(resolve, 3200));
      setResult(response);
      setForging(false);
      setArrowAngle(0);
      setSelectedIds(new Set());
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80);
      await loadInventory();
      hapticNotify(response.success ? 'success' : 'error');
      if (response.success) {
        if (response.domain) playReveal(response.domain.rarity);
        playCoin();
      }
      void refresh().catch(() => undefined);
    } catch (error) {
      setForging(false);
      setArrowAngle(0);
      toast(error instanceof Error ? error.message : 'Не удалось выполнить апгрейд', 'error');
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="domain forge"
        title="Апгрейдер"
        description="Соберите домены в один апгрейд. Чем выше риск — тем дороже награда, но при провале сгорает всё."
      />

      <AnimatePresence>
        {result && <ResultCard result={result} onClose={() => setResult(null)} />}
      </AnimatePresence>

      <section className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-accent/50 via-gold/25 to-teal/40 p-px shadow-neon-lime">
        <div className="relative overflow-hidden rounded-[15px] bg-ink-800">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-accent/[0.13] to-transparent" />
          <div className="relative p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-gold">
                  domain forge
                </div>
                <div className="mt-1 font-display text-[13px] font-semibold text-paper">
                  Шанс на апгрейд
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-right">
                <div className="text-[7px] uppercase tracking-[0.12em] text-muted/60">в работе</div>
                <div className="font-display text-[12px] font-semibold text-paper">
                  {selectedItems.length} / 50
                </div>
              </div>
            </div>

            <div className="relative flex justify-center py-1">
              <ChanceWheel
                percent={sector.sector}
                multiplier={sector.multiplier}
                chanceRange={chanceRange}
                color={SECTOR_COLORS[sectorIndex % SECTOR_COLORS.length]}
                arrowAngle={0}
                moving={false}
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {sectors.map((item, index) => {
                const active = index === sectorIndex;
                return (
                  <button
                    key={item.sector}
                    type="button"
                    disabled={forging}
                    onClick={() => {
                      setSectorIndex(index);
                      hapticImpact('light');
                    }}
                    className={cn(
                      'rounded-lg border px-1 py-2 text-center transition',
                      active ? '' : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.14]',
                    )}
                    style={
                      active
                        ? {
                            borderColor: `${SECTOR_COLORS[index]}80`,
                            background: `${SECTOR_COLORS[index]}1A`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="font-display text-[12px] font-bold"
                      style={{ color: active ? SECTOR_COLORS[index] : undefined }}
                    >
                      {item.sector}%
                    </div>
                    <div className="mt-0.5 text-[7px] text-muted">×{item.multiplier}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.07] bg-ink-900/70 p-3">
              <ForgeStat label="Сумма" value={`${formatNumber(sum)} D`} />
              <ForgeStat label="Цель" value={`${formatNumber(target)} D`} good />
              <ForgeStat
                label="Точный шанс"
                value={`${chanceRange[0].toFixed(0)}–${chanceRange[1].toFixed(0)}%`}
              />
            </div>

            <div className="mt-3 min-h-[54px]">
              {selectedItems.length ? (
                <div className="flex gap-1.5 overflow-x-auto axis-x pb-0.5">
                  {selectedItems.slice(0, 4).map((item) => (
                    <SelectedChip key={item.id} item={item} onRemove={() => toggle(item.id)} />
                  ))}
                  {selectedItems.length > 4 && (
                    <div className="flex shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[9px] text-muted">
                      +{selectedItems.length - 4}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('forge-inventory')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] py-2.5 text-[9px] text-muted transition hover:border-accent/40 hover:text-paper"
                >
                  <PackageOpen size={13} /> Выберите домены из инвентаря ниже
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!selectedItems.length || forging}
              onClick={() => setConfirmOpen(true)}
              className={cn(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] transition active:scale-[0.99]',
                selectedItems.length
                  ? 'bg-gradient-to-r from-accent via-[#6D8CFF] to-teal text-[#08101B] shadow-neon-lime'
                  : 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-muted/50',
              )}
            >
              {forging ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={17} />}
              {forging ? 'Куём…' : 'Прокачать'}
            </button>
          </div>
        </div>
      </section>

      <div id="forge-inventory" className="mb-2.5 flex items-center justify-between">
        <div>
          <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-accent-soft">
            инвентарь
          </div>
          <div className="mt-0.5 text-[10px] text-muted">
            {items === null ? 'Загрузка…' : `${items.length} доменов`}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!items?.length || forging}
            onClick={() => {
              setSelectedIds(new Set((items ?? []).slice(0, 50).map((item) => item.id)));
              hapticImpact('light');
            }}
            className="bulk-chip"
          >
            Все
          </button>
          <button
            type="button"
            disabled={!selectedIds.size || forging}
            onClick={() => setSelectedIds(new Set())}
            className="bulk-chip"
          >
            Сбросить
          </button>
        </div>
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[104px] animate-pulse rounded-xl bg-white/[0.02]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Нет доменов для апгрейда"
          description="Сначала выиграйте домены в рулетке."
        />
      ) : (
        <div className="grid max-h-[350px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
          {items.map((item) => {
            const selected = selectedIds.has(item.id);
            const meta = RARITY[item.domain.rarity];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'relative overflow-hidden rounded-xl border p-2.5 text-left transition active:scale-[0.99]',
                  selected
                    ? 'border-accent/65 bg-accent/[0.09]'
                    : 'border-white/[0.07] bg-ink-800 hover:border-white/[0.14]',
                )}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="text-[7px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      'flex items-center justify-center rounded border',
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-white/15 text-transparent',
                    )}
                    style={{ width: 17, height: 17 }}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                </div>
                <div className="mt-2.5 truncate font-display text-[13px] font-semibold text-paper">
                  {item.domain.name}
                  <span style={{ color: meta.color }}>{item.domain.zone}</span>
                </div>
                <div className="mt-1 font-display text-[10px] font-semibold text-muted">
                  {formatNumber(item.domain.price)} D
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-rarity-legendary/20 bg-rarity-legendary/[0.05] px-3.5 py-3 text-[9px] leading-relaxed text-muted">
        <Flame size={13} className="mt-0.5 shrink-0 text-rarity-legendary" />
        При провале все выбранные домены сгорают. Mythic-домены тоже можно улучшать.
      </div>

      <AnimatePresence>
        {forging && (
          <ForgeOverlay
            items={selectedItems}
            percent={sector.sector}
            multiplier={sector.multiplier}
            color={SECTOR_COLORS[sectorIndex % SECTOR_COLORS.length]}
            chanceRange={chanceRange}
            arrowAngle={arrowAngle}
          />
        )}
      </AnimatePresence>

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Запустить апгрейд?">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.07] bg-ink-900 p-4">
            <div className="flex justify-between text-[10px] text-muted">
              <span>Доменов сгорит</span>
              <span className="font-display text-base font-semibold text-paper">
                {selectedItems.length}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted">
              <span>Суммарная стоимость</span>
              <span className="text-paper">{formatNumber(sum)} D</span>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted">
              <span>Шанс / множитель</span>
              <span className="text-gold">
                {sector.sector}–{(sector.sector + 0.99).toFixed(2)}% · ×{sector.multiplier}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-rarity-legendary/20 bg-rarity-legendary/[0.05] px-3 py-2.5 text-[9px] leading-relaxed text-muted">
            <CircleSlash2 size={12} className="mt-0.5 shrink-0 text-rarity-legendary" />
            Это необратимо. При неудаче домены удаляются, компенсации нет.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-[10px] font-medium text-muted"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void runUpgrade()}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-teal py-2.5 text-[10px] font-bold text-[#08101B]"
            >
              <Hammer size={12} /> Прокачать
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function ForgeStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[7px] uppercase tracking-[0.1em] text-muted/60">{label}</div>
      <div
        className={cn(
          'mt-0.5 font-display text-[10px] font-semibold',
          good ? 'text-gold' : 'text-paper',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SelectedChip({ item, onRemove }: { item: InventoryItem; onRemove: () => void }) {
  const meta = RARITY[item.domain.rarity];
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5"
      style={{ borderColor: `${meta.color}45`, background: `${meta.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      <span className="max-w-[105px] truncate font-display text-[9px] font-semibold text-paper">
        {item.domain.name}
        <span style={{ color: meta.color }}>{item.domain.zone}</span>
      </span>
      <span className="text-[8px] text-muted">{formatNumber(item.domain.price)} D</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-muted/60 transition hover:text-paper"
        aria-label="Убрать домен"
      >
        <X size={10} />
      </button>
    </div>
  );
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function ChanceWheel({
  percent,
  multiplier,
  chanceRange,
  color,
  arrowAngle,
  moving,
  large = false,
}: {
  percent: number;
  multiplier: number;
  chanceRange: [number, number] | number[];
  color: string;
  arrowAngle: number;
  moving: boolean;
  large?: boolean;
}) {
  const size = large ? 250 : 218;
  const center = 120;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(100, Math.max(0, percent)) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-6 rounded-full blur-2xl"
        style={{ background: `${color}1F` }}
      />
      <svg viewBox="0 0 240 240" className="relative h-full w-full overflow-visible">
        <circle cx={center} cy={center} r={104} fill="none" stroke="#273A52" strokeWidth="1" opacity=".7" />
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#24364E" strokeWidth="16" />

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ filter: `drop-shadow(0 0 7px ${color}88)` }}
        />

        {Array.from({ length: 48 }).map((_, index) => {
          const angle = index * 7.5;
          const inner = polar(center, center, 68, angle);
          const outer = polar(center, center, index % 4 === 0 ? 74 : 72, angle);
          return (
            <line
              key={index}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={index % 4 === 0 ? '#7E98B8' : '#41536C'}
              strokeWidth={index % 4 === 0 ? 1.4 : 1}
              strokeLinecap="round"
              opacity={index % 4 === 0 ? 0.65 : 0.4}
            />
          );
        })}

        <circle cx={center} cy={center} r={59} fill="#0E1724" stroke="#2A3A52" strokeWidth="1" />
        <circle
          cx={center}
          cy={center}
          r={50}
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity=".38"
        />

        <g
          style={{
            transform: `rotate(${arrowAngle}deg)`,
            transformOrigin: '120px 120px',
            transition: moving ? 'transform 2.2s cubic-bezier(.12,.72,.12,1)' : 'none',
          }}
        >
          <path d="M114 2 L126 2 L120 16 Z" fill={color} />
          <line
            x1="120"
            y1="16"
            x2="120"
            y2="25"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[7px] font-bold uppercase tracking-[0.26em] text-muted/60">
          chance
        </div>
        <div className="mt-1 font-display text-[34px] font-bold leading-none tracking-tight text-paper">
          {moving ? '···' : `${percent}%`}
        </div>
        <div
          className="mt-1.5 rounded-full border px-2 py-0.5 font-display text-[10px] font-semibold"
          style={{ borderColor: `${color}55`, background: `${color}14`, color }}
        >
          ×{multiplier}
        </div>
        <div className="mt-2 text-[7px] text-muted/60">
          {moving
            ? 'стрелка решает'
            : `${chanceRange[0].toFixed(2)}–${chanceRange[1].toFixed(2)}%`}
        </div>
      </div>
    </div>
  );
}

function ForgeOverlay({
  items,
  percent,
  multiplier,
  color,
  chanceRange,
  arrowAngle,
}: {
  items: InventoryItem[];
  percent: number;
  multiplier: number;
  color: string;
  chanceRange: [number, number] | number[];
  arrowAngle: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#080E17]/88 px-6 backdrop-blur-md"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
        style={{ background: `${color}26` }}
      />
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-[330px] rounded-2xl border bg-ink-800 p-5 text-center shadow-card"
        style={{ borderColor: `${color}55` }}
      >
        <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-gold">
          domain forge
        </div>
        <div className="mt-1 font-display text-lg font-semibold text-paper">Куём апгрейд…</div>
        <div className="mt-2 flex justify-center">
          <ChanceWheel
            percent={percent}
            multiplier={multiplier}
            chanceRange={chanceRange}
            color={color}
            arrowAngle={arrowAngle}
            moving
            large
          />
        </div>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-[9px] text-muted">
          <Sparkles size={11} style={{ color }} />
          {items.length} доменов · {percent}% шанс
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '110%' }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-accent-soft to-transparent"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ResultCard({ result, onClose }: { result: UpgradeResult; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border p-4',
        result.success
          ? 'border-teal/35 bg-gradient-to-br from-teal/[0.12] via-ink-800 to-accent/[0.08]'
          : 'border-rarity-mythic/30 bg-gradient-to-br from-rarity-mythic/[0.1] via-ink-800 to-ink-800',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[10px] font-semibold',
            result.success ? 'text-teal' : 'text-rarity-mythic',
          )}
        >
          {result.success ? <Sparkles size={12} /> : <Flame size={12} />}
          {result.success ? 'Апгрейд удался' : 'Домены сгорели'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted/60 transition hover:text-paper"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
      {result.success && result.domain ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <RarityBadge rarity={result.domain.rarity} />
            <span className="text-[8px] text-muted">
              шанс {result.chance.toFixed(2)}% · ×{result.multiplier}
            </span>
          </div>
          <div className="mt-2 font-display text-[26px] font-semibold tracking-tight text-paper">
            {result.domain.name}
            <span style={{ color: RARITY[result.domain.rarity].color }}>
              {result.domain.zone}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-muted">
            Цена {formatNumber(result.domain.price)} D · потрачено {formatNumber(result.spent_value)} D
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 font-display text-xl font-semibold text-paper">
            Не в этот раз
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-muted">
            Шанс был {result.chance.toFixed(2)}%. Сумма {formatNumber(result.spent_value)} D
            списана из коллекции.
          </div>
        </>
      )}
    </motion.div>
  );
}
