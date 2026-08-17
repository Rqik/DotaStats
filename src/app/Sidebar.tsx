import {
  BookOpen,
  ChevronRight,
  FileSearch,
  HardDrive,
  LayoutDashboard,
  Settings,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Logo } from '../components/Logo';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard },
  { to: '/analysis', label: 'Новый анализ', icon: FileSearch },
  { to: '/bets', label: 'Журнал ставок', icon: BookOpen },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open ? (
        <button
          className="sidebar__scrim"
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
        />
      ) : null}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <Logo />
          <button
            className="sidebar__close"
            type="button"
            onClick={onClose}
            aria-label="Закрыть меню"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="Основная навигация">
          <span className="sidebar__caption">Рабочее пространство</span>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => (
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              )}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__spacer" />
        <NavLink
          className="sidebar__local"
          to="/settings"
          onClick={onClose}
          aria-label="Открыть настройки локальных данных"
        >
          <HardDrive size={17} />
          <span>
            <strong>Локальные данные</strong>
            <small>Экспорт, импорт и очистка</small>
          </span>
          <ChevronRight className="sidebar__local-arrow" size={16} aria-hidden="true" />
        </NavLink>
      </aside>
    </>
  );
}
