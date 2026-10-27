import { Link } from 'react-router-dom';
import { ChevronRight, Radio, Settings2, Shield, ShieldCheck, Trophy } from 'lucide-react';
import { PageTitle } from '@/components/PageTitle';
import { useAuth } from '@/context/AuthContext';

const LINKS = [
  {
    to: '/leaderboard',
    label: 'Рейтинг',
    description: 'Топ-20 коллекций по сумме цен',
    icon: Trophy,
    color: '#F2A54A',
  },
  {
    to: '/drops',
    label: 'Лента дропов',
    description: 'Последние 20 выпадений в реальном времени',
    icon: Radio,
    color: '#4D9BFF',
  },
  {
    to: '/settings',
    label: 'Настройки',
    description: 'Автопродажа по редкости и цене',
    icon: Settings2,
    color: '#B07CFF',
  },
];

export function MorePage() {
  const { me } = useAuth();
  const links = me?.user.is_admin
    ? [
        {
          to: '/admin',
          label: 'Админка',
          description: 'Баланс, баны и выдача доменов',
          icon: Shield,
          color: '#43D6C5',
        },
        ...LINKS,
      ]
    : LINKS;

  return (
    <div>
      <PageTitle
        eyebrow="navigation"
        title="Ещё"
        description="Рейтинг, живая лента и настройки автопродажи."
      />

      <div className="space-y-2">
        {links.map(({ to, label, description, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-ink-800 p-4 transition hover:border-white/[0.12] active:scale-[0.99]"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg border"
              style={{ borderColor: `${color}30`, background: `${color}10`, color }}
            >
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-paper">{label}</div>
              <div className="mt-0.5 truncate text-[9px] text-muted">{description}</div>
            </div>
            <ChevronRight size={15} className="text-muted/50" />
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.05] bg-ink-800/60 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted">
          <ShieldCheck size={13} className="text-accent-soft" />
          О приложении
        </div>
        <p className="text-[9px] leading-relaxed text-muted/70">
          Domain Drop — игровая рулетка. В каталоге используются реальные зарегистрированные
          доменные имена из публичного рейтинга, но это только игровые карточки: приложение не
          продаёт домены, не регистрирует их и не передаёт права. Цены и редкость — игровые.
          Монеты нельзя купить или вывести.
        </p>
      </div>
    </div>
  );
}
