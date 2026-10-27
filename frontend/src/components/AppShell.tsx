import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Backdrop } from '@/components/Backdrop';
import { BottomNav } from '@/components/BottomNav';
import { TopBar } from '@/components/TopBar';
import { cn } from '@/lib/utils';

export function AppShell() {
  const location = useLocation();
  const isEarn = location.pathname === '/earn';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen [min-height:100dvh]">
      <Backdrop />
      <div className="relative z-10">
        <TopBar />
        <main
          className={cn(
            'mx-auto w-full max-w-md px-4',
            isEarn
              ? 'overflow-hidden pb-[84px] pt-4'
              : 'pb-32 pt-5',
          )}
          style={
            isEarn
              ? { height: 'calc(100dvh - 62px - env(safe-area-inset-top, 0px))' }
              : undefined
          }
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0.82 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={cn(isEarn && 'h-full min-h-0')}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
