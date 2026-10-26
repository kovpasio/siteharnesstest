import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useTelegram } from '@/hooks/useTelegram';
import { ProfilePage } from '@/pages/ProfilePage';
import { RoulettePage } from '@/pages/RoulettePage';
import { InventoryPage } from '@/pages/InventoryPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { DropsPage } from '@/pages/DropsPage';
import { VerifyPage } from '@/pages/VerifyPage';

export default function App() {
  const { loading, error, me, retry } = useAuth();
  useTelegram();

  if (loading) return <Splash />;

  if (error || !me) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 [min-height:100dvh]">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-rarity-mythic/10 blur-[90px]" />
        <div className="relative w-full max-w-sm rounded-[28px] border border-white/10 bg-ink-800/80 p-7 text-center backdrop-blur-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rarity-mythic/20 bg-rarity-mythic/10 text-rarity-mythic">
            <WifiOff size={24} />
          </div>
          <h1 className="font-display text-xl font-bold text-white">Нет подключения</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/40">
            {error ?? 'Не удалось загрузить профиль.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-lime py-3.5 font-display text-sm font-bold text-ink-950 transition active:scale-[0.98]"
          >
            <RefreshCw size={16} />
            Попробовать снова
          </button>
          <p className="mt-4 text-[10px] leading-relaxed text-white/25">
            Демо-режим работает в браузере. Для Telegram откройте Mini App через бота.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ProfilePage />} />
        <Route path="/roulette" element={<RoulettePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/drops" element={<DropsPage />} />
        <Route path="/verify" element={<VerifyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Splash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-ink-950">
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-lime/[0.06] blur-[90px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center"
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] border border-neon-lime/30 bg-neon-lime/10 shadow-neon-lime">
          <span className="font-display text-2xl font-bold tracking-tighter text-neon-lime">
            D<span className="text-white/30">/</span>Z
          </span>
          <motion.span
            className="absolute inset-0 rounded-[26px] border border-neon-lime/40"
            animate={{ scale: [1, 1.18], opacity: [0.7, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-5 font-display text-[13px] font-bold tracking-[0.28em] text-white">
          DROP<span className="text-neon-lime">.ZONE</span>
        </div>
        <div className="mt-2 text-[9px] uppercase tracking-[0.32em] text-white/25">
          loading the drop engine
        </div>
        <div className="mt-8 h-[2px] w-32 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full w-1/2 rounded-full bg-neon-lime"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
