import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpFromLine, Coins, Dices, Ellipsis, Package, UserRound } from 'lucide-react';
import { cn, hapticSelection } from '@/lib/utils';

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof UserRound;
  accent?: boolean;
  activePaths?: string[];
};

const ITEMS: NavItemDef[] = [
  { to: '/', label: 'Профиль', icon: UserRound },
  { to: '/inventory', label: 'Инвентарь', icon: Package },
  { to: '/roulette', label: 'Рулетка', icon: Dices, accent: true },
  { to: '/earn', label: 'Заработок', icon: Coins },
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
      <div className="relative border-t border-white/[0.08] bg-ink-900/95 pb-[max(env(safe-area-inset-bottom),9px)] pt-1.5 backdrop-blur-xl">
        <div className="grid grid-cols-6 items-end px-1">
          {ITEMS.map((item) => {
            const active = item.activePaths
              ? item.activePaths.includes(location.pathname)
              : location.pathname === item.to;
            return (
              <NavItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                accent={Boolean(item.accent)}
                active={active}
              />
            );
          })}
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
  accent,
}: {
  to: string;
  label: string;
  icon: typeof UserRound;
  active: boolean;
  accent: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={() => hapticSelection()}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1 pb-1.5 pt-1 transition',
        active ? 'text-paper' : 'text-muted/65 hover:text-paper/80',
      )}
    >
      <span
        className={cn(
          'flex h-[26px] items-center justify-center rounded-lg transition',
          accent
            ? 'w-[30px] bg-gradient-to-br from-accent to-teal text-[#07111D] shadow-neon-lime'
            : 'w-[26px]',
        )}
      >
        <Icon size={accent ? 18 : 17} strokeWidth={active || accent ? 2.2 : 1.8} />
      </span>
      <span className="w-full truncate text-center text-[7.5px] font-medium leading-none">
        {label}
      </span>
      {active && (
        <motion.span
          layoutId="nav-dot"
          className="absolute top-0 h-[2px] w-4 rounded-full bg-accent-soft"
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
    </Link>
  );
}
