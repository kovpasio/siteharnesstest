import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Radio,
  RefreshCw,
  SignalZero,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api, dropsWebSocketUrl } from '@/api/client';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/PageTitle';
import { RarityBadge } from '@/components/RarityBadge';
import type { Drop } from '@/types';
import {
  cn,
  formatNumber,
  RARITY,
  timeAgo,
} from '@/lib/utils';

type Status = 'connecting' | 'live' | 'offline';

export function DropsPage() {
  const { toast } = useToast();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [status, setStatus] = useState<Status>('connecting');
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setTick((value) => value + 1), 10_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;

    setLoading(true);
    void api
      .drops()
      .then((response) => {
        if (!disposed) setDrops(response.drops);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          toast(error instanceof Error ? error.message : 'Не удалось загрузить ленту', 'error');
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    function scheduleReconnect() {
      if (disposed) return;
      const delay = Math.min(8_000, 1_400 * 2 ** attempt);
      attempt += 1;
      reconnectRef.current = window.setTimeout(connect, delay);
    }

    function connect() {
      if (disposed) return;
      setStatus('connecting');
      let socket: WebSocket;
      try {
        socket = new WebSocket(dropsWebSocketUrl());
      } catch {
        setStatus('offline');
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setStatus('live');
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const payload = JSON.parse(event.data) as
            | { type: 'snapshot'; drops: Drop[] }
            | { type: 'drop'; drop: Drop }
            | { type: 'ping' };
          if (payload.type === 'snapshot') {
            setDrops(payload.drops.slice(0, 20));
          } else if (payload.type === 'drop') {
            setDrops((current) => [
              payload.drop,
              ...current.filter((drop) => drop.spin_id !== payload.drop.spin_id),
            ].slice(0, 20));
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onerror = () => {
        setStatus('offline');
        socket.close();
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus('offline');
        scheduleReconnect();
      };
    }

    connect();
    const ping = window.setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send('ping');
      }
    }, 20_000);

    return () => {
      disposed = true;
      window.clearInterval(ping);
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [toast]);

  return (
    <div>
      <PageTitle
        eyebrow="live feed"
        title="Лента дропов"
        description="Последние 20 выпавших доменов в реальном времени — со всех рулеток."
        action={<StatusPill status={status} />}
      />

      <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-800 p-4">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/[0.07] text-neon-cyan">
              <Activity size={17} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-white/80">Глобальный поток</div>
              <div className="mt-0.5 text-[9px] text-white/30">
                {status === 'live' ? 'WebSocket подключён' : 'Переподключение к потоку…'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-white">{drops.length}</div>
            <div className="text-[8px] uppercase tracking-[0.14em] text-white/25">в буфере</div>
          </div>
        </div>
        {status === 'live' && (
          <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
            <motion.div
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      {loading && drops.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[76px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]"
            />
          ))}
        </div>
      ) : drops.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Пока тихо"
          description="Как только кто-то прокрутит рулетку, дроп появится здесь мгновенно."
          action={
            <Link
              to="/roulette"
              className="flex items-center gap-1.5 rounded-xl bg-neon-lime px-4 py-2.5 text-[11px] font-bold text-ink-950"
            >
              <Zap size={13} /> Сделать первый дроп
            </Link>
          }
        />
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {drops.map((drop) => (
              <motion.div
                key={drop.spin_id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              >
                <DropRow drop={drop} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[9px] text-white/18">
        <Sparkles size={10} />
        Дропы транслируются через Redis Pub/Sub
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return (
    <div
      className={cn(
        'mt-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em]',
        status === 'live'
          ? 'border-neon-lime/25 bg-neon-lime/[0.08] text-neon-lime'
          : status === 'connecting'
            ? 'border-rarity-legendary/25 bg-rarity-legendary/[0.07] text-rarity-legendary'
            : 'border-rarity-mythic/25 bg-rarity-mythic/[0.07] text-rarity-mythic',
      )}
    >
      {status === 'live' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-lime opacity-70" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-neon-lime" />
        </span>
      ) : status === 'connecting' ? (
        <RefreshCw size={9} className="animate-spin" />
      ) : (
        <SignalZero size={9} />
      )}
      {status === 'live' ? 'live' : status === 'connecting' ? 'sync' : 'offline'}
    </div>
  );
}

function DropRow({ drop }: { drop: Drop }) {
  const meta = RARITY[drop.rarity];
  return (
    <div
      className={cn(
        'flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5',
        drop.auto_sold ? 'border-accent/20 bg-accent/[0.04]' : 'border-white/[0.055] bg-ink-800/70',
      )}
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
        style={{
          borderColor: `${meta.color}35`,
          background: `linear-gradient(145deg, ${meta.color}20, transparent)`,
        }}
      >
        <span className="font-display text-[10px] font-bold" style={{ color: meta.color }}>
          {drop.domain.zone.replace('.', '').toUpperCase()}
        </span>
        <span
          className="absolute inset-x-0 bottom-0 h-[2px]"
          style={{ background: meta.color }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-[13px] font-bold tracking-tight text-white/90">
            {drop.domain.name}
            <span style={{ color: meta.color }}>{drop.domain.zone}</span>
          </span>
          <RarityBadge rarity={drop.rarity} dot={false} className="hidden px-1.5 py-0 text-[7px] min-[390px]:inline-flex" />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[8px] text-white/28">
          <Avatar src={drop.avatar_url} name={drop.display_name} size={13} />
          <span className="truncate">@{drop.username}</span>
          <span>·</span>
          <span className="shrink-0">{timeAgo(drop.created_at)}</span>
          {drop.auto_sold && (
            <span className="shrink-0 rounded bg-accent/10 px-1 text-[7px] font-medium text-accent-soft">
              авто
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-display text-[13px] font-bold text-white/80">
          {formatNumber(drop.price)}
          <span className="ml-0.5 text-[8px] text-white/25">D</span>
        </div>
        <div className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-white/20">
          #{drop.spin_id}
        </div>
      </div>
    </div>
  );
}
