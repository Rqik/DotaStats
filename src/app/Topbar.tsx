import { Bell, CircleHelp, Menu } from 'lucide-react';

interface TopbarProps { onMenu: () => void; }

export function Topbar({ onMenu }: TopbarProps) {
  return <header className="topbar"><button className="topbar__menu" type="button" onClick={onMenu} aria-label="Открыть меню"><Menu size={20} /></button><div className="topbar__context"><span className="topbar__live" /><span className="topbar__status">OpenDota доступна</span><span className="topbar__divider" /><span className="topbar__muted">Обновлено 12 минут назад</span></div><div className="topbar__actions"><button className="topbar__icon" type="button" aria-label="Помощь"><CircleHelp size={19} /></button><button className="topbar__icon topbar__icon--notification" type="button" aria-label="Уведомления"><Bell size={19} /><span /></button></div></header>;
}
