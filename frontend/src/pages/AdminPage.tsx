import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ban,
  Check,
  Coins,
  Gift,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageTitle } from '@/components/PageTitle';
import type { AdminOverview, AdminUser, Rarity } from '@/types';
import { cn, formatNumber, hapticImpact, hapticNotify } from '@/lib/utils';

const GRANT_RARITIES: Array<{ value: Rarity | undefined; label: string }> = [
  { value: undefined, label: 'Любой' },
  { value: 'common', label: 'Common' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'mythic', label: 'Mythic' },
];

export function AdminPage() {
  const { me, applyBalance } = useAuth();
  const { toast } = useToast();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [amount, setAmount] = useState('1000');
  const [grantRarity, setGrantRarity] = useState<Rarity | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const isAdmin = Boolean(me?.user.is_admin);

  async function load(search = query) {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [nextOverview, nextUsers] = await Promise.all([
        api.adminOverview(),
        api.adminUsers(search),
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers.users);
      setTotal(nextUsers.total);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось загрузить админку', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-ink-800 p-6 text-center">
        <ShieldCheck size={28} className="mx-auto text-muted/40" />
        <h1 className="mt-3 font-display text-lg font-semibold text-paper">Доступ закрыт</h1>
        <p className="mt-1 text-[10px] text-muted">Эта страница доступна только администратору.</p>
      </div>
    );
  }

  async function changeBalance(user: AdminUser, sign: number) {
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta <= 0) {
      toast('Введите положительную сумму', 'error');
      return;
    }
    setBusyId(user.id);
    hapticImpact('light');
    try {
      const updated = await api.adminBalance(user.id, sign * delta);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.id === me?.user.id) {
        applyBalance(updated.balance);
      }
      hapticNotify('success');
      toast(
        `${sign > 0 ? 'Выдано' : 'Списано'} ${formatNumber(delta)} D · ${updated.display_name}`,
        'success',
      );
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось изменить баланс', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBan(user: AdminUser) {
    setBusyId(user.id);
    hapticImpact('medium');
    try {
      const updated = await api.adminBan(
        user.id,
        !user.is_banned,
        user.is_banned ? undefined : 'Заблокирован администратором',
      );
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      hapticNotify('success');
      toast(updated.is_banned ? 'Пользователь забанен' : 'Пользователь разбанен', 'success');
      void load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось изменить бан', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function grantDomain(user: AdminUser) {
    setBusyId(user.id);
    hapticImpact('light');
    try {
      const result = await api.adminGrantDomain(user.id, grantRarity);
      hapticNotify('success');
      toast(
        `${result.domain.full_name} выдан ${user.display_name} · ${formatNumber(result.domain.price)} D`,
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось выдать домен', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="admin console"
        title="Админка"
        description="Баланс, баны и выдача доменов. Доступна только @anxiohalcy."
      />

      {overview && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <AdminStat icon={Users} label="Игроки" value={formatNumber(overview.users)} />
          <AdminStat icon={Ban} label="Баны" value={formatNumber(overview.banned)} accent="text-rarity-mythic" />
          <AdminStat icon={ShieldCheck} label="Админы" value={formatNumber(overview.admins)} accent="text-teal" />
          <AdminStat icon={Coins} label="Балансы" value={formatNumber(overview.total_balance)} />
          <AdminStat icon={Sparkles} label="Спины" value={formatNumber(overview.total_spins)} />
          <AdminStat icon={Gift} label="Домены" value={formatNumber(overview.inventory_count)} />
        </div>
      )}

      <section className="mb-4 rounded-2xl border border-white/[0.07] bg-ink-800 p-3.5">
        <div className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold text-paper">
          <Coins size={13} className="text-gold" /> Выдать или списать баланс
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
            className="field max-w-[150px] text-right font-display text-lg"
          />
          <span className="text-[10px] text-muted">D</span>
        </div>
        <p className="mt-1.5 text-[8px] text-muted/60">
          Сумма применяется кнопками «+» и «−» на карточке пользователя.
        </p>
      </section>

      <section className="mb-4 rounded-2xl border border-white/[0.07] bg-ink-800 p-3.5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-paper">
          <Gift size={13} className="text-accent-soft" /> Какой домен выдавать
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GRANT_RARITIES.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setGrantRarity(value)}
              className={cn(
                'rounded-md border px-2 py-1 text-[8px] font-medium transition',
                grantRarity === value
                  ? 'border-accent/50 bg-accent/15 text-paper'
                  : 'border-white/[0.06] bg-white/[0.025] text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
        className="mb-3 flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="@username или Telegram ID"
            className="field pl-9"
          />
        </div>
        <button
          type="submit"
          className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-soft"
          aria-label="Найти"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            void load('');
          }}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-muted"
          aria-label="Обновить"
        >
          <RefreshCw size={15} />
        </button>
      </form>

      <div className="mb-2 flex items-center justify-between text-[8px] uppercase tracking-[0.12em] text-muted/60">
        <span>Пользователи · {total}</span>
        <span>limit 50</span>
      </div>

      <div className="space-y-2">
        {users.map((user) => {
          const isSelf = user.id === me?.user.id;
          const busy = busyId === user.id;
          return (
            <motion.div
              key={user.id}
              layout
              className={cn(
                'rounded-xl border p-3',
                user.is_banned
                  ? 'border-rarity-mythic/25 bg-rarity-mythic/[0.05]'
                  : 'border-white/[0.06] bg-ink-800',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold text-paper">
                      {user.display_name}
                    </span>
                    {user.is_admin && (
                      <span className="rounded bg-teal/10 px-1 py-0.5 text-[7px] font-bold text-teal">
                        ADMIN
                      </span>
                    )}
                    {user.is_banned && (
                      <span className="rounded bg-rarity-mythic/10 px-1 py-0.5 text-[7px] font-bold text-rarity-mythic">
                        BAN
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[7px] text-muted">
                        вы
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[8px] text-muted">
                    @{user.username ?? '—'} · ID {user.telegram_id}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[12px] font-semibold text-paper">
                    {formatNumber(user.balance)} D
                  </div>
                  <div className="mt-0.5 text-[7px] text-muted/60">{user.total_spins} спинов</div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void changeBalance(user, 1)}
                  className="flex items-center justify-center gap-1 rounded-md border border-teal/25 bg-teal/10 py-1.5 text-[8px] font-semibold text-teal disabled:opacity-50"
                >
                  <Plus size={10} /> Выдать
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void changeBalance(user, -1)}
                  className="flex items-center justify-center gap-1 rounded-md border border-rarity-mythic/25 bg-rarity-mythic/10 py-1.5 text-[8px] font-semibold text-rarity-mythic disabled:opacity-50"
                >
                  <TrendingDown size={10} /> Списать
                </button>
                <button
                  type="button"
                  disabled={busy || isSelf || user.is_admin}
                  onClick={() => void toggleBan(user)}
                  className="flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[8px] text-muted disabled:opacity-30"
                  aria-label={user.is_banned ? 'Разбанить' : 'Забанить'}
                >
                  {user.is_banned ? <Check size={11} /> : <Ban size={11} />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void grantDomain(user)}
                  className="flex items-center justify-center rounded-md border border-accent/20 bg-accent/10 px-2 text-accent-soft disabled:opacity-50"
                  aria-label="Выдать домен"
                >
                  <Gift size={11} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!loading && users.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-[10px] text-muted">
          Пользователи не найдены
        </div>
      )}
    </div>
  );
}

function AdminStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-800 p-2.5">
      <div className="flex items-center gap-1 text-[7px] uppercase tracking-[0.08em] text-muted/60">
        <Icon size={10} /> {label}
      </div>
      <div className={cn('mt-1 font-display text-[13px] font-semibold text-paper', accent)}>
        {value}
      </div>
    </div>
  );
}
