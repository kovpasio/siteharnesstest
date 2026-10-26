import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Rarity } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = ['#ff8a1f', '#ff3d55', '#ffd166', '#b6ff3b', '#39e8ff', '#a855f7'];

export function DropFlash({ rarity }: { rarity: Rarity | null }) {
  const intense = rarity === 'mythic';
  return createPortal(
    <AnimatePresence>
      {rarity && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
        >
          <div className={cn('flash-overlay absolute inset-0', intense && 'saturate-150')} />
          <div className="absolute inset-0">
            {Array.from({ length: intense ? 34 : 22 }).map((_, index) => {
              const left = 6 + ((index * 37) % 88);
              const delay = (index % 8) * 0.06;
              const size = 4 + (index % 5) * 2;
              return (
                <span
                  key={index}
                  className="confetti absolute top-0 rounded-[2px]"
                  style={{
                    left: `${left}%`,
                    width: size,
                    height: size * (1 + (index % 3) * 0.6),
                    background: COLORS[index % COLORS.length],
                    boxShadow: `0 0 10px ${COLORS[index % COLORS.length]}`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 0], scale: [0.8, 1.1, 1.25] }}
            transition={{ duration: 1.2, times: [0, 0.22, 1] }}
            className="absolute inset-x-0 top-[38%] text-center"
          >
            <div
              className="font-display text-[54px] font-black tracking-[0.15em] text-white"
              style={{ textShadow: '0 0 40px #fff, 0 0 90px #ff8a1f' }}
            >
              {intense ? 'MYTHIC' : 'LEGENDARY'}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
