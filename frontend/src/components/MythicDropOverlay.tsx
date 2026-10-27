import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import type { Domain } from '@/types';
import { formatNumber, RARITY } from '@/lib/utils';

const MYTHIC = RARITY.mythic.color;

export function MythicDropOverlay({
  domain,
  onClose,
}: {
  domain: Domain;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6200);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        id: index,
        left: 8 + Math.random() * 84,
        delay: Math.random() * 1.4,
        duration: 1.7 + Math.random() * 1.6,
        drift: -34 + Math.random() * 68,
        size: 2 + Math.random() * 5,
        rotate: Math.random() * 360,
      })),
    [],
  );

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[#07070E]/92 px-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Мифический дроп"
      onClick={onClose}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${MYTHIC}33 0%, ${MYTHIC}0D 30%, transparent 66%)`,
        }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: `${MYTHIC}55` }}
        animate={{ scale: [0.65, 2.1], opacity: [0.8, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: `${MYTHIC}44` }}
        animate={{ scale: [0.7, 2.5], opacity: [0.7, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${MYTHIC}66 22deg, transparent 55deg, transparent 180deg, ${MYTHIC}44 210deg, transparent 250deg)`,
          maskImage: 'radial-gradient(circle, transparent 58%, black 60%, black 68%, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(circle, transparent 58%, black 60%, black 68%, transparent 70%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      />

      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="pointer-events-none absolute top-[18%] rounded-sm"
          style={{
            left: `${particle.left}%`,
            width: particle.size,
            height: particle.size * 2.4,
            background: particle.id % 3 === 0 ? '#F7D38A' : MYTHIC,
            boxShadow: `0 0 9px ${particle.id % 3 === 0 ? '#F7D38A' : MYTHIC}`,
          }}
          initial={{ opacity: 0, y: -20, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, 190, 390],
            x: [0, particle.drift, particle.drift * 1.7],
            rotate: particle.rotate + 260,
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeIn',
          }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.82, y: 22, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="relative w-full max-w-[340px] overflow-hidden rounded-[26px] border p-6 text-center"
        style={{
          borderColor: `${MYTHIC}88`,
          background:
            'linear-gradient(160deg, rgba(48,20,32,0.98) 0%, rgba(22,18,32,0.98) 48%, rgba(12,14,24,0.99) 100%)',
          boxShadow: `0 0 0 1px ${MYTHIC}22, 0 30px 90px ${MYTHIC}33, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:text-white"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>

        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.1, repeat: Infinity }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border"
          style={{
            borderColor: `${MYTHIC}70`,
            background: `radial-gradient(circle, ${MYTHIC}40, transparent 70%)`,
            boxShadow: `0 0 34px ${MYTHIC}66`,
          }}
        >
          <Sparkles size={25} style={{ color: '#FFD8DC' }} />
        </motion.div>

        <div
          className="mt-4 text-[9px] font-bold uppercase tracking-[0.42em]"
          style={{ color: MYTHIC }}
        >
          mythic drop
        </div>
        <motion.div
          initial={{ letterSpacing: '0.02em' }}
          animate={{ letterSpacing: '0.14em' }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="mt-1 bg-gradient-to-b from-white via-[#FFD3D8] to-[#F06473] bg-clip-text font-display text-[38px] font-bold leading-none text-transparent"
          style={{ filter: `drop-shadow(0 0 22px ${MYTHIC}88)` }}
        >
          MYTHIC
        </motion.div>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3.5">
          <div className="font-display text-[21px] font-semibold leading-tight text-white">
            {domain.name}
            <span style={{ color: MYTHIC }}>{domain.zone}</span>
          </div>
          <div className="mt-1.5 font-display text-[15px] font-semibold" style={{ color: '#F7D38A' }}>
            {formatNumber(domain.price)} D
          </div>
        </div>

        <p className="mt-4 text-[9px] leading-relaxed text-white/40">
          Мифический домен уже в коллекции. Это один из самых редких дропов в игре.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#190A10] transition active:scale-[0.99]"
          style={{ background: `linear-gradient(90deg, #F7D38A, ${MYTHIC})` }}
        >
          Продолжить
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
