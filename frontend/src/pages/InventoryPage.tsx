import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeDollarSign,
  CircleSlash2,
  Filter,
  PackageOpen,
  Sparkles,
  Tag,
  Wallet,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/context/SoundContext';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { RarityBadge } from '@/components/RarityBadge';
import type { InventoryItem, Rarity, Zone } from '@/types';
import {
  cn,
  formatNumber,
  hapticImpact,
  hapticNotify,
  RARITY,
  RARITY_ORDER,
  ZONE_META,
} from '@/lib/utils';

type ZoneFilter = 'all' | Zone;
type RarityFilter = 'all' | Rarity;

export function InventoryPage() {
  const { applyBalance, refresh } = useAuth();
  const { toast } = useToast();
  const { playCoin } = useSound();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [zone, setZone] = useState<ZoneFilter>('all');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    void api
      .inventory()
      .then((data) => {
        if (mounted) setItems(data);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setItems([]);
          toast(error instanceof Error ? error.message : 'Не удалось загрузить инвентарь', 'error');
        }
      });
    return () => {
      mounted = false;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items
      .filter((item) => (zone === 'all' ? true : item.domain.zone === zone))
      .filter((item) => (rarity === 'all' ? true : item.domain.rarity === rarity))
      .sort((a, b) => b.domain.price - a.domain.price);
  }, [items, zone, rarity]);

  const totalValue = useMemo(
    () => (items ?? []).reduce((sum, item) => sum + item.domain.price, 0),
    [items],
  );
  const bestDrop = useMemo(
    () =>
      (items ?? []).reduce<InventoryItem | null>(
        (best, item) => (!best || item.domain.price > best.domain.price ? item : best),
        null,
      ),
    [items],
  );

  async function sellSelected() {
    if (!selected || selling) return;
    setSelling(true);
    hapticImpact('medium');
    try {
      const result = await api.sell(selected.id);
      setItems((current) =>
        current ? current.filter((item) => item.id !== selected.id) : current,
      );
      applyBalance(result.balance);
      playCoin();
      hapticNotify('success');
      toast(`Домен продан за ${result.sold_price} D`, 'success');
      setSelected(null);
      void refresh().catch(() => undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось продать домен', 'error');
    } finally {
      setSelling(false);
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="collection vault"
        title="Инвентарь"
        description="Домены из спинов. Продавайте, чтобы пополнить баланс или собирайте сильнейшую коллекцию."
        action={
          <Link
            to="/roulette"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl border border-neon-lime/25 bg-neon-lime/[0.08] text-neon-lime transition active:scale-95"
            aria-label="К рулетке"
          >
            <Sparkles size={16} />
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="col-span-2 relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-transparent p-4">
          <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-neon-lime/[0.08] blur-2xl" />
          <div className="label mb-2">Стоимость коллекции</div>
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-neon-lime" />
            <span className="font-display text-2xl font-bold tracking-tight text-white">
              {formatNumber(totalValue)}
            </span>
            <span className="text-[9px] font-bold text-white/25">D</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="label mb-2">Домены</div>
          <div className="font-display text-2xl font-bold text-white">
            {items?.length ?? '—'}
          </div>
          <div className="mt-1 text-[9px] text-white/25">
            {bestDrop ? `топ ${bestDrop.domain.name}` : 'пока пусто'}
          </div>
        </div>
      </div>

      <div className="mb-5 space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto axis-x pb-0.5">
          <div className="mr-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/22">
            <Filter size={10} /> зона
          </div>
          {(['all', '.ru', '.com', '.io'] as ZoneFilter[]).map((value) => (
            <FilterChip
              key={value}
              active={zone === value}
              onClick={() => {
                setZone(value);
                hapticImpact('light');
              }}
              label={value === 'all' ? 'Все' : value}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto axis-x pb-0.5">
          <div className="mr-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/22">
            <Tag size={10} /> редкость
          </div>
          <FilterChip
            active={rarity === 'all'}
            onClick={() => {
              setRarity('all');
              hapticImpact('light');
            }}
            label="Все"
          />
          {RARITY_ORDER.map((value) => (
            <FilterChip
              key={value}
              active={rarity === value}
              onClick={() => {
                setRarity(value);
                hapticImpact('light');
              }}
              label={RARITY[value].label}
              color={RARITY[value].color}
            />
          ))}
        </div>
      </div>

      {items === null ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={items.length === 0 ? PackageOpen : CircleSlash2}
          title={items.length === 0 ? 'Коллекция пуста' : 'Ничего не найдено'}
          description={
            items.length === 0
              ? 'Крутите рулетку — каждый дроп попадёт сюда.'
              : 'Попробуйте изменить фильтры.'
          }
          action={
            items.length === 0 ? (
              <Link
                to="/roulette"
                className="flex items-center gap-1.5 rounded-xl bg-neon-lime px-4 py-2.5 text-[11px] font-bold text-ink-950"
              >
                Крутить <ArrowRight size={13} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setZone('all');
                  setRarity('all');
                }}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[11px] font-semibold text-white/60"
              >
                Сбросить фильтры
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between text-[9px] text-white/25">
            <span className="font-semibold uppercase tracking-[0.16em]">
              {filtered.length} {filtered.length === 1 ? 'домен' : 'доменов'}
            </span>
            <span>по цене ↓</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.18 }}
                >
                  <InventoryCard item={item} onSell={() => setSelected(item)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <BottomSheet open={Boolean(selected)} onClose={() => setSelected(null)} title="Продать домен?">
        {selected && (
          <div>
            <div
              className="relative mt-1 overflow-hidden rounded-2xl border p-5 text-center"
              style={{
                borderColor: `${RARITY[selected.domain.rarity].color}55`,
                background: `linear-gradient(150deg, ${RARITY[selected.domain.rarity].color}22, rgba(13,16,26,.85))`,
              }}
            >
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <RarityBadge rarity={selected.domain.rarity} className="mb-3" />
              <div className="font-display text-[29px] font-bold tracking-tight text-white">
                {selected.domain.name}
                <span style={{ color: RARITY[selected.domain.rarity].color }}>
                  {selected.domain.zone}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-white/35">
                {ZONE_META[selected.domain.zone].label} · {RARITY[selected.domain.rarity].label}
              </div>
            </div>

            <div className="my-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
              <div className="flex items-center gap-2 text-[11px] text-white/45">
                <BadgeDollarSign size={15} className="text-neon-lime" />
                Вы получите
              </div>
              <div className="font-display text-xl font-bold text-neon-lime">
                +{formatNumber(selected.domain.price)} D
              </div>
            </div>

            <p className="mb-4 text-center text-[10px] leading-relaxed text-white/28">
              После продажи домен исчезнет из коллекции и перестанет учитываться в рейтинге.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-white/10 bg-white/[0.04] py-3 text-[12px] font-semibold text-white/55 transition active:scale-[0.98]"
              >
                Оставить
              </button>
              <button
                type="button"
                disabled={selling}
                onClick={() => void sellSelected()}
                className="rounded-xl bg-neon-lime py-3 text-[12px] font-bold text-ink-950 transition active:scale-[0.98] disabled:opacity-60"
              >
                {selling ? 'Продаём…' : `Продать за ${selected.domain.price} D`}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition',
        active
          ? 'border-white/25 bg-white/[0.11] text-white'
          : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/60',
      )}
      style={active && color ? { borderColor: `${color}66`, color, background: `${color}16` } : undefined}
    >
      {label}
    </button>
  );
}

function InventoryCard({ item, onSell }: { item: InventoryItem; onSell: () => void }) {
  const meta = RARITY[item.domain.rarity];
  return (
    <div
      className="group relative overflow-hidden rounded-[20px] border bg-ink-800/70 p-3"
      style={{ borderColor: `${meta.color}33` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-40 blur-2xl"
        style={{ background: meta.glow }}
      />
      <div className="relative flex items-start justify-between">
        <RarityBadge rarity={item.domain.rarity} />
        <span className="font-display text-[10px] font-bold text-white/30">{item.domain.price} D</span>
      </div>

      <div className="relative mt-5 min-h-[48px]">
        <div className="truncate font-display text-[17px] font-bold leading-tight tracking-tight text-white">
          {item.domain.name}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: meta.color }}>
          {item.domain.zone}
        </div>
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
        <span className={cn('rounded px-1.5 py-0.5 text-[8px] font-bold', ZONE_META[item.domain.zone].className)}>
          {ZONE_META[item.domain.zone].label}
        </span>
        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            onSell();
          }}
          className="rounded-lg border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[9px] font-bold text-white/60 transition hover:border-neon-lime/30 hover:text-neon-lime active:scale-95"
        >
          Продать
        </button>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
      />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[158px] animate-pulse rounded-[20px] border border-white/[0.05] bg-white/[0.025]"
        />
      ))}
    </div>
  );
}
