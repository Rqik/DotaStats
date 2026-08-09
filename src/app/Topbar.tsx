import { CircleHelp, Menu } from 'lucide-react';

interface TopbarProps {
  onMenu: () => void;
  onHelp: (trigger: HTMLElement) => void;
}

export function Topbar({ onMenu, onHelp }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="topbar__menu"
        type="button"
        onClick={onMenu}
        aria-label="Открыть меню"
      >
        <Menu size={20} />
      </button>
      <div className="topbar__context">
        <span className="topbar__status">OpenDota загружается по запросу</span>
        <span className="topbar__divider" />
        <span className="topbar__muted">Кэш и пользовательские данные хранятся локально</span>
      </div>
      <div className="topbar__actions">
        <button
          className="topbar__icon"
          type="button"
          aria-label="Открыть справку"
          onClick={(event) => onHelp(event.currentTarget)}
        >
          <CircleHelp size={19} />
        </button>
      </div>
    </header>
  );
}
