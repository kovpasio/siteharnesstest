import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpFromLine,
  Check,
  CircleSlash2,
  Flame,
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
import {
  cn,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
} from '@/lib/utils';

const FALLBACK_SECTORS: UpgradeSector[] = [
  { sector: 10, multiplier: 9, ev: 0.9 },
  { sector: 25, multiplier: 3.75, ev: 0.9375 },
  { sector: 50, multiplier: 1.9, ev: 0.95 },
  { sector: 75, multiplier: 1.2, ev: 0.9 },
];

export function UpgraderPage() {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin, playReveal } = useSound();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sectorIndex, setSectorIndex] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
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
  }, []);

  const selectedItems = useMemo(
    () => (items ?? []).filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const sum = selectedItems.reduce((total, item) => total + item.domain.price, 0);
  const target = Math.round(sum * sector.multiplier);

  function toggle(id: number) {
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
    if (!selectedItems.length || upgrading) return;
    setUpgrading(true);
    setConfirmOpen(false);
    hapticImpact('medium');
    try {
      const response = await api.upgrade(
        selectedItems.map((item) => item.id),
        sector.sector,
      );
      setResult(response);
      setSelectedIds(new Set());
      await loadInventory();
      hapticNotify(response.success ? 'success' : 'error');
      if (response.success) playReveal(response.domain?.rarity ?? 'epic');
      else toast('Апгрейд не удался — домены сгорели', 'error');
      void refresh().catch(() => undefined);
      if (response.success) playCoin();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось выполнить апгрейд', 'error');
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="upgrader"
        title="Апгрейдер"
        description="Объедините один или несколько доменов и попробуйте получить более ценное имя. При провале все выбранные домены сгорают."
      />

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'mb-4 overflow-hidden rounded-2xl border p-4',
              result.success
                ? 'border-accent/30 bg-accent/[0.06]'
                : 'border-rarity-mythic/25 bg-rarity-mythic/[0.05]',
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn('text-[10px] font-semibold', result.success ? 'text-accent-soft' : 'text-rarity-mythic')}>
                {result.success ? 'Улучшение успешно' : 'Улучшение не удалось'}
              </span>
              <button
                type="button"
                onClick={() => setResult(null)}
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
                  Оценка {formatNumber(result.domain.price)} D · потрачено{' '}
                  {formatNumber(result.spent_value)} D
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 font-display text-xl font-semibold text-paper">
                  Домены сгорели
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-muted">
                  Шанс был {result.chance.toFixed(2)}%. Сумма {formatNumber(result.spent_value)} D
                  списана из коллекции.
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {items === null ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[120px] animate-pulse rounded-xl bg-white/[0.02]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Нет доменов для апгрейда"
          description="Сначала выиграйте домены в рулетке."
        />
      ) : (
        <>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted/60">
              Выберите домены · {items.length}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set(items.slice(0, 50).map((item) => item.id)));
                  hapticImpact('light');
                }}
                className="bulk-chip"
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="bulk-chip"
              >
                Сбросить
              </button>
            </div>
          </div>

          <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
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
                      ? 'border-accent/60 bg-accent/[0.07]'
                      : 'border-white/[0.06] bg-ink-800',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[7px] font-semibold uppercase tracking-[0.1em]" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span
                      className={cn(
                        'flex h-4.5 w-4.5 items-center justify-center rounded border',
                        selected
                          ? 'border-accent bg-accent text-white'
                          : 'border-white/15 text-transparent',
                      )}
                      style={{ width: 18, height: 18 }}
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                  </div>
                  <div className="mt-3 truncate font-display text-[13px] font-semibold text-paper">
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

          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-ink-800 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold text-paper">Шанс и множитель</div>
                <div className="mt-0.5 text-[8px] text-muted">
                  точный шанс сервер выберет в диапазоне{' '}
                  {chanceRange[0].toFixed(2)}–{chanceRange[1].toFixed(2)}%
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold text-accent-soft">
                  ×{sector.multiplier}
                </div>
                <div className="text-[8px] text-muted">EV {sector.ev.toFixed(3)}</div>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={sectors.length - 1}
              step={1}
              value={sectorIndex}
              onChange={(event) => {
                setSectorIndex(Number(event.target.value));
                hapticImpact('light');
              }}
              className="chance-slider mt-4 w-full"
              aria-label="Сектор шанса апгрейда"
            />
            <div className="mt-2 flex justify-between">
              {sectors.map((item, index) => (
                <button
                  key={item.sector}
                  type="button"
                  onClick={() => {
                    setSectorIndex(index);
                    hapticImpact('light');
                  }}
                  className={cn(
                    'text-center transition',
                    index === sectorIndex ? 'text-paper' : 'text-muted/50',
                  )}
                >
                  <div className="font-display text-[11px] font-semibold">{item.sector}%</div>
                  <div className="mt-0.5 text-[7px]">×{item.multiplier}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.05] bg-ink-800/60 px-3.5 py-3">
            <div className="flex justify-between text-[9px] text-muted">
              <span>Выбрано</span>
              <span className="text-paper">
                {selectedItems.length} · {formatNumber(sum)} D
              </span>
            </div>
            <div className="mt-1.5 flex justify-between text-[9px] text-muted">
              <span>Ожидаемая цель</span>
              <span className="text-paper/80">
                ≈ {formatNumber(target)} D ±20%
              </span>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              disabled={!selectedItems.length || upgrading}
              onClick={() => setConfirmOpen(true)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[12px] font-semibold transition',
                selectedItems.length
                  ? 'bg-accent text-white hover:bg-accent-soft'
                  : 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-muted/50',
              )}
            >
              {upgrading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ArrowUpFromLine size={16} />
              )}
              {upgrading ? 'Улучшаем…' : 'Улучшить домены'}
            </button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rarity-legendary/15 bg-rarity-legendary/[0.04] px-3.5 py-3 text-[9px] leading-relaxed text-muted">
            <Flame size={13} className="mt-0.5 shrink-0 text-rarity-legendary" />
            При провале все выбранные домены исчезают. Mythic-домены тоже можно улучшать.
          </div>
        </>
      )}

      {upgrading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-ink-800 px-8 py-6 shadow-card">
            <motion.div
              className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-accent/10"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles size={20} className="text-accent-soft" />
            </motion.div>
            <div className="mt-3 font-display text-[12px] font-semibold text-paper">
              Апгрейд...
            </div>
            <div className="mt-1 text-[9px] text-muted">Сгорают выбранные домены</div>
          </div>
        </div>
      )}

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Подтвердить апгрейд?">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-ink-900 p-4">
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
              <span>Шанс сектора</span>
              <span className="text-accent-soft">
                {sector.sector}–{(sector.sector + 0.99).toFixed(2)}% · ×{sector.multiplier}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-rarity-legendary/15 bg-rarity-legendary/[0.04] px-3 py-2.5 text-[9px] leading-relaxed text-muted">
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
              className="flex items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-[10px] font-semibold text-white"
            >
              <ArrowUpFromLine size={12} /> Улучшить
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
