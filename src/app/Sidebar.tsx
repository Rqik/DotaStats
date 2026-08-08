import { BookOpen, FileSearch, LayoutDashboard, MoreHorizontal, Settings, WalletCards, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Logo } from '../components/Logo';

interface SidebarProps { open: boolean; onClose: () => void; }

const navItems = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard },
  { to: '/analysis', label: 'Новый анализ', icon: FileSearch },
  { to: '/bets', label: 'Журнал ставок', icon: BookOpen },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open ? <button className="sidebar__scrim" type="button" onClick={onClose} aria-label="Закрыть меню" /> : null}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header"><Logo /><button className="sidebar__close" type="button" onClick={onClose} aria-label="Закрыть меню"><X size={18} /></button></div>
        <nav className="sidebar__nav" aria-label="Основная навигация">
          <span className="sidebar__caption">Рабочее пространство</span>
          {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}><Icon size={19} strokeWidth={1.8} /><span>{label}</span>{to === '/analysis' ? <span className="sidebar__badge">N</span> : null}</NavLink>)}
        </nav>
        <div className="sidebar__spacer" />
        <div className="sidebar__bank"><div className="sidebar__bank-heading"><span>Текущий банк</span><WalletCards size={16} /></div><strong>52 840 ₽</strong><div className="sidebar__progress"><span /></div><small><b>+5.7%</b> от стартового банка</small></div>
        <div className="sidebar__profile"><div className="sidebar__avatar">АК</div><div><strong>Алексей К.</strong><span><i /> Данные локально</span></div><MoreHorizontal size={18} /></div>
      </aside>
    </>
  );
}
