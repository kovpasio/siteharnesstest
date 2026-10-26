import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dices, Package, Radio, Trophy, UserRound } from 'lucide-react';
import { cn, hapticSelection } from '@/lib/utils';

const ITEMS = [
  { to: '/', label: 'Профиль', icon: UserRound },
  { to: '/inventory', label: 'Инвентарь', icon: Package },
  { to: '/leaderboard', label: 'Топ', icon: Trophy },
  { to: '/drops', label: 'Дропы', icon: Radio },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md">
      <div className="relative border-t border-white/[0.07] bg-ink-950/90 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-2xl">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-28 w-36 -translate-x-1/2 bg-neon-lime/[0.07] blur-3xl" />
        <div className="relative grid grid-cols-5 items-end px-2">
          {ITEMS.slice(0, 2).map((item) => (
            <NavItem key={item.to} {...item} active={location.pathname === item.to} />
          ))}

          <div className="flex justify-center">
            <Link
              to="/roulette"
              onClick={() => hapticSelection()}
              aria-label="Крутить рулетку"
              className={cn(
                'group relative -mt-7 flex h-[58px] w-[58px] items-center justify-center rounded-[20px] border transition active:scale-95',
                location.pathname === '/roulette'
                  ? 'border-[#d9ff9b] bg-neon-lime shadow-[0_0_34px_rgba(182,255,59,.4)]'
                  : 'border-neon-lime/40 bg-gradient-to-br from-[#d4ff85] to-[#9ee62e] shadow-[0_0_26px_rgba(182,255,59,.24)]',
              )}
            >
              <span className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/30 to-transparent opacity-60" />
              <Dices size={25} className="relative text-ink-950" strokeWidth={2.4} />
            </Link>
          </div>

          {ITEMS.slice(2).map((item) => (
            <NavItem key={item.to} {...item} active={location.pathname === item.to} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof UserRound;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={() => hapticSelection()}
      className={cn(
        'relative flex flex-col items-center gap-1.5 pb-2 pt-1 transition',
        active ? 'text-white' : 'text-white/32 hover:text-white/60',
      )}
    >
      <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
      <span className="text-[9px] font-semibold tracking-[0.02em]">{label}</span>
      {active && (
        <motion.span
          layoutId="nav-dot"
          className="absolute -top-0.5 h-[3px] w-5 rounded-full bg-neon-lime shadow-[0_0_9px_rgba(182,255,59,.8)]"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
    </Link>
  );
}
