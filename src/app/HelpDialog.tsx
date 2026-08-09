import { Database, ShieldCheck, Sigma, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import './HelpDialog.scss';

interface HelpDialogProps {
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}

export function HelpDialog({ returnFocusTo, onClose }: HelpDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [returnFocusTo]);

  return (
    <div className="help-dialog" role="presentation">
      <section
        ref={dialogRef}
        className="help-dialog__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="help-dialog__header">
          <div><span>Справка Dota Pulse</span><h2 id={titleId}>Как читать расчёты</h2></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Закрыть справку">
            <X size={18} />
          </button>
        </header>
        <div className="help-dialog__content">
          <article>
            <Database size={20} />
            <div><h3>Источники данных</h3><p>Матчи, команды и герои загружаются из OpenDota. Каждый результат показывает сеть, свежий или устаревший кэш и возраст данных.</p></div>
          </article>
          <article>
            <Sigma size={20} />
            <div><h3>Прозрачные формулы</h3><p>Фора использует сглаженные частоты и порог безубыточности. Драфт показывает отдельные вклады таймингов, матчапов и формы, а не скрытую рекомендацию.</p></div>
          </article>
          <article>
            <ShieldCheck size={20} />
            <div><h3>Приватность и ограничения</h3><p>Ставки, анализы и настройки хранятся в этом браузере. Вероятность не гарантирует исход; малые и неполные выборки всегда отмечаются предупреждением.</p></div>
          </article>
        </div>
        <footer className="help-dialog__footer">
          <button type="button" onClick={onClose}>Понятно</button>
        </footer>
      </section>
    </div>
  );
}
