import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpFromLine, Dices, Ellipsis, Package, UserRound } from 'lucide-react';
import { cn, hapticSelection } from '@/lib/utils';

const ITEMS = [
  { to: '/', label: 'Профиль', icon: UserRound },
  { to: '/inventory', label: 'Инвентарь', icon: Package },
  { to: '/upgrader', label: 'Апгрейдер', icon: ArrowUpFromLine },
  {
    to: '/more',
    label: 'Ещё',
    icon: Ellipsis,
    activePaths: ['/more', '/leaderboard', '/drops', '/settings'],
  },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md">
      <div className="relative border-t border-white/[0.07] bg-ink-900/95 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-xl">
        <div className="relative grid grid-cols-5 items-end px-2">
          {ITEMS.slice(0, 2).map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={location.pathname === item.to}
            />
          ))}

          <div className="flex justify-center">
            <Link
              to="/roulette"
              onClick={() => hapticSelection()}
              aria-label="Крутить рулетку"
              className={cn(
                'relative -mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-2xl border transition active:scale-95',
                location.pathname === '/roulette'
                  ? 'border-teal/60 bg-gradient-to-br from-accent to-teal text-[#07111D] shadow-neon-lime'
                  : 'border-accent/50 bg-gradient-to-br from-accent/90 to-accent-deep text-white shadow-neon-lime',
              )}
            >
              <Dices size={24} strokeWidth={2} />
            </Link>
          </div>

          {ITEMS.slice(2).map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={
                item.activePaths
                  ? item.activePaths.includes(location.pathname)
                  : location.pathname === item.to
              }
            />
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
  activePaths?: string[];
}) {
  return (
    <Link
      to={to}
      onClick={() => hapticSelection()}
      className={cn(
        'relative flex flex-col items-center gap-1.5 pb-2 pt-1 transition',
        active ? 'text-paper' : 'text-muted/65 hover:text-paper/80',
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="text-[9px] font-medium">{label}</span>
      {active && (
        <motion.span
          layoutId="nav-dot"
          className="absolute -top-0.5 h-[2px] w-5 rounded-full bg-accent-soft"
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
    </Link>
  );
}
