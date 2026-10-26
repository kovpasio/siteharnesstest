import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Binary,
  Check,
  CheckCircle2,
  Copy,
  Fingerprint,
  Hash,
  Info,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/context/ToastContext';
import { RarityBadge } from '@/components/RarityBadge';
import type { VerifyResult } from '@/types';
import {
  cn,
  copyText,
  formatNumber,
  hapticNotify,
  RARITY,
} from '@/lib/utils';

type Tab = 'spin' | 'seeds';

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const initialSpin = searchParams.get('spin') ?? '';
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>(initialSpin ? 'spin' : 'seeds');
  const [spinId, setSpinId] = useState(initialSpin);
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState('1');
  const [pityCounter, setPityCounter] = useState('0');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const runSpin = useCallback(
    async (rawId: string) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) {
        setError('Введите корректный ID спина');
        return;
      }
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const data = await api.verifySpin(id);
        setResult(data);
        hapticNotify(data.verified ? 'success' : 'error');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Спин не найден');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!initialSpin || autoRan.current) return;
    autoRan.current = true;
    setSpinId(initialSpin);
    void runSpin(initialSpin);
  }, [initialSpin, runSpin]);

  async function runSeeds() {
    if (!serverSeed.trim() || !clientSeed.trim()) {
      setError('Заполните server_seed и client_seed');
      return;
    }
    const parsedNonce = Number(nonce);
    const parsedPity = Number(pityCounter);
    if (!Number.isInteger(parsedNonce) || parsedNonce < 1) {
      setError('Nonce должен быть целым числом ≥ 1');
      return;
    }
    if (!Number.isInteger(parsedPity) || parsedPity < 0 || parsedPity > 50) {
      setError('Pity counter должен быть от 0 до 50');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.verifySeeds({
        server_seed: serverSeed.trim(),
        client_seed: clientSeed.trim(),
        nonce: parsedNonce,
        pity_counter: parsedPity,
      });
      setResult(data);
      hapticNotify('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить сиды');
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, label: string) {
    const ok = await copyText(value);
    toast(ok ? `${label} скопирован` : 'Не удалось скопировать', ok ? 'success' : 'error');
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setResult(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[10px] font-semibold text-white/35 transition hover:text-white/70"
        >
          <ArrowLeft size={13} /> Назад
        </Link>
        <span className="rounded-full border border-neon-cyan/20 bg-neon-cyan/[0.06] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-neon-cyan">
          provably fair
        </span>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-neon-cyan/70">
          audit terminal
        </div>
        <h1 className="font-display text-[27px] font-bold leading-none tracking-tight text-white">
          Проверка честности
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-white/38">
          Каждый спин детерминирован: результат можно пересчитать из раскрытого server seed.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
        <TabButton active={tab === 'spin'} onClick={() => switchTab('spin')} icon={Hash}>
          По ID спина
        </TabButton>
        <TabButton active={tab === 'seeds'} onClick={() => switchTab('seeds')} icon={KeyRound}>
          По сидам
        </TabButton>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {tab === 'spin' ? (
            <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4">
              <label htmlFor="spin-id" className="label mb-2 block">
                Spin ID
              </label>
              <div className="flex gap-2">
                <input
                  id="spin-id"
                  inputMode="numeric"
                  value={spinId}
                  onChange={(event) => setSpinId(event.target.value.replace(/\D/g, ''))}
                  placeholder="например 42"
                  className="field font-display tracking-wide"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void runSpin(spinId);
                  }}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void runSpin(spinId)}
                  className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-neon-cyan px-4 text-[11px] font-bold text-ink-950 transition active:scale-95 disabled:opacity-60"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Проверить
                </button>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-white/25">
                ID отображается на карточке дропа и в ленте. По нему сервер заново считает
                результат и сравнивает с сохранённым.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4">
              <div>
                <label htmlFor="server-seed" className="label mb-2 block">
                  server_seed
                </label>
                <textarea
                  id="server-seed"
                  value={serverSeed}
                  onChange={(event) => setServerSeed(event.target.value)}
                  placeholder="64-символьный hex из результата спина"
                  rows={3}
                  className="field resize-none leading-relaxed"
                />
              </div>
              <div>
                <label htmlFor="client-seed" className="label mb-2 block">
                  client_seed
                </label>
                <input
                  id="client-seed"
                  value={clientSeed}
                  onChange={(event) => setClientSeed(event.target.value)}
                  placeholder="client seed"
                  className="field"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="nonce" className="label mb-2 block">
                    nonce
                  </label>
                  <input
                    id="nonce"
                    inputMode="numeric"
                    value={nonce}
                    onChange={(event) => setNonce(event.target.value.replace(/\D/g, ''))}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="pity" className="label mb-2 block">
                    pity counter
                  </label>
                  <input
                    id="pity"
                    inputMode="numeric"
                    value={pityCounter}
                    onChange={(event) => setPityCounter(event.target.value.replace(/\D/g, ''))}
                    className="field"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void runSeeds()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-cyan py-3 text-[12px] font-bold text-ink-950 transition active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Binary size={15} />}
                Пересчитать результат
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-start gap-2 rounded-2xl border border-rarity-mythic/25 bg-rarity-mythic/[0.07] px-4 py-3 text-[11px] text-rarity-mythic"
        >
          <ShieldX size={14} className="mt-0.5 shrink-0" />
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-3"
          >
            <div
              className={cn(
                'flex items-center gap-3 rounded-[22px] border p-4',
                result.verified
                  ? 'border-neon-lime/25 bg-neon-lime/[0.06]'
                  : 'border-rarity-mythic/30 bg-rarity-mythic/[0.07]',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl border',
                  result.verified
                    ? 'border-neon-lime/30 bg-neon-lime/10 text-neon-lime'
                    : 'border-rarity-mythic/30 bg-rarity-mythic/10 text-rarity-mythic',
                )}
              >
                {result.verified ? <CheckCircle2 size={19} /> : <ShieldX size={19} />}
              </div>
              <div className="flex-1">
                <div className="font-display text-[13px] font-semibold text-white">
                  {result.spin_id
                    ? result.verified
                      ? `Спин #${result.spin_id} подтверждён`
                      : `Спин #${result.spin_id}: расхождение`
                    : 'Расчёт по сидам выполнен'}
                </div>
                <div className="mt-0.5 text-[9px] text-white/35">
                  {result.spin_id
                    ? result.verified
                      ? 'Хеш, редкость и домен совпали с записью'
                      : 'Серверная запись не совпала с пересчётом'
                    : 'Формула воспроизведена детерминированно'}
                </div>
              </div>
              {result.verified && (
                <span className="rounded bg-neon-lime px-1.5 py-1 text-[8px] font-extrabold uppercase text-ink-950">
                  valid
                </span>
              )}
            </div>

            <div
              className="relative overflow-hidden rounded-[22px] border p-5"
              style={{
                borderColor: `${RARITY[result.rarity].color}50`,
                background: `linear-gradient(150deg, ${RARITY[result.rarity].color}22, rgba(10,12,19,.92))`,
              }}
            >
              <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full blur-[55px]" style={{ background: RARITY[result.rarity].glow }} />
              <div className="relative flex items-center justify-between">
                <RarityBadge rarity={result.rarity} />
                <span className="text-[8px] uppercase tracking-[0.14em] text-white/25">
                  {result.spin_id ? `spin #${result.spin_id}` : 'computed'}
                </span>
              </div>
              <div className="relative mt-4 font-display text-[33px] font-bold leading-none tracking-tight text-white">
                {result.computed_domain.name}
                <span style={{ color: RARITY[result.rarity].color }}>
                  {result.computed_domain.zone}
                </span>
              </div>
              <div className="relative mt-3 flex items-center gap-3 text-[10px] text-white/35">
                <span>{result.pity_applied ? 'Epic+ гарантия' : 'обычный ролл'}</span>
                <span>·</span>
                <span>стоимость {formatNumber(result.computed_domain.price)} D</span>
              </div>
              {result.spin_id && result.computed_domain.id !== result.domain.id && (
                <div className="relative mt-3 rounded-lg border border-rarity-mythic/30 bg-rarity-mythic/10 px-3 py-2 text-[9px] text-rarity-mythic">
                  В записи: {result.domain.full_name}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <VerifyTile label="Rarity roll" value={String(result.rarity_roll)} />
              <VerifyTile
                label="Domain index"
                value={`${result.domain_index} / ${result.bucket_size}`}
              />
              <VerifyTile
                label="Base rarity"
                value={result.base_rarity}
                accent={RARITY[result.base_rarity].color}
              />
              <VerifyTile
                label="SHA-256"
                value={result.hash_valid ? 'совпадает' : 'ошибка'}
                accent={result.hash_valid ? '#b6ff3b' : '#ff3d55'}
              />
            </div>

            <div className="space-y-3 rounded-[22px] border border-white/[0.07] bg-white/[0.022] p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
                <Fingerprint size={12} className="text-neon-cyan" /> Данные спина
              </div>
              <CopyField
                label="server_seed"
                value={result.server_seed}
                onCopy={() => void copy(result.server_seed, 'server_seed')}
              />
              <CopyField
                label="server_seed_hash"
                value={result.server_seed_hash}
                onCopy={() => void copy(result.server_seed_hash, 'server_seed_hash')}
              />
              <div className="grid grid-cols-2 gap-2">
                <CopyField
                  label="client_seed"
                  value={result.client_seed}
                  onCopy={() => void copy(result.client_seed, 'client_seed')}
                />
                <CopyField
                  label="nonce"
                  value={String(result.nonce)}
                  onCopy={() => void copy(String(result.nonce), 'nonce')}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/[0.07] bg-[#05060a]/80 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                <Info size={11} /> Формула
              </div>
              <code className="block break-words font-mono text-[9px] leading-relaxed text-neon-cyan/65">
                {result.formula}
              </code>
              <div className="mt-2 flex items-center gap-1.5 text-[8px] text-white/20">
                <Check size={9} /> SHA-256(server_seed) опубликован до спина
              </div>
            </div>

            {result.spin_id && (
              <Link
                to="/drops"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] py-3 text-[10px] font-semibold text-white/45"
              >
                <Sparkles size={12} /> Вернуться к ленте дропов
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !loading && (
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
            <Info size={12} className="text-neon-cyan" /> Как это работает
          </div>
          <ol className="space-y-2 text-[10px] leading-relaxed text-white/28">
            <li className="flex gap-2">
              <span className="text-neon-cyan/60">01</span>
              Сервер генерирует server_seed и публикует sha256(server_seed) до спина.
            </li>
            <li className="flex gap-2">
              <span className="text-neon-cyan/60">02</span>
              Результат = HMAC_SHA256(server_seed, client_seed:nonce) mod 10000.
            </li>
            <li className="flex gap-2">
              <span className="text-neon-cyan/60">03</span>
              После спина seed раскрывается — любой может повторить расчёт.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Hash;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[10px] font-semibold transition',
        active ? 'text-ink-950' : 'text-white/35 hover:text-white/60',
      )}
    >
      {active && (
        <motion.span
          layoutId="verify-tab"
          className="absolute inset-0 rounded-xl bg-neon-cyan"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
      <Icon size={12} className="relative" />
      <span className="relative">{children}</span>
    </button>
  );
}

function VerifyTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.022] px-3.5 py-3">
      <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/22">{label}</div>
      <div className="mt-1 font-display text-[13px] font-bold capitalize" style={{ color: accent ?? 'rgba(255,255,255,.72)' }}>
        {value}
      </div>
    </div>
  );
}

function CopyField({
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
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/22">{label}</span>
        <button type="button" onClick={onCopy} className="text-white/22 transition hover:text-white/60">
          <Copy size={10} />
        </button>
      </div>
      <code className="block break-all rounded-lg border border-white/[0.05] bg-black/25 px-2.5 py-2 font-mono text-[9px] leading-relaxed text-white/45">
        {value}
      </code>
    </div>
  );
}
