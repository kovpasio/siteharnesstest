import { useEffect, useMemo } from 'react';
import { getTelegram } from '@/lib/utils';

export function useTelegram() {
  const tg = useMemo(() => getTelegram(), []);

  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor('#05060a');
      tg.setBackgroundColor('#05060a');
    } catch {
      // older Telegram clients do not implement these methods
    }
    try {
      tg.disableVerticalSwipes?.();
    } catch {
      // optional API
    }
  }, [tg]);

  return {
    tg,
    isTelegram: Boolean(tg?.initData),
    platform: tg?.platform,
    user: tg?.initDataUnsafe?.user,
  };
}
