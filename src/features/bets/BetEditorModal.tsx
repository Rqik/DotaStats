import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { Bet, BetDraft, BetResult, StakeType } from './betStore';
import './BetEditorModal.scss';

interface BetEditorModalProps {
  bet?: Bet;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
  onSubmit: (bet: BetDraft) => void;
}

interface BetFormErrors {
  tournament?: string;
  match?: string;
  selection?: string;
  odds?: string;
  stake?: string;
}

const resultLabels: Record<BetResult, string> = {
  pending: 'Ожидает',
  win: 'Выигрыш',
  loss: 'Проигрыш',
  refund: 'Возврат',
};

function today(): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

export function BetEditorModal({ bet, returnFocusTo, onClose, onSubmit }: BetEditorModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [date, setDate] = useState(bet?.date ?? today());
  const [tournament, setTournament] = useState(bet?.tournament ?? '');
  const [match, setMatch] = useState(bet?.match ?? '');
  const [selection, setSelection] = useState(bet?.selection ?? '');
  const [odds, setOdds] = useState(bet?.odds.toString() ?? '');
  const [stake, setStake] = useState(bet?.stake.toString() ?? '');
  const [stakeType, setStakeType] = useState<StakeType>(bet?.stakeType ?? 'cash');
  const [result, setResult] = useState<BetResult>(bet?.result ?? 'pending');
  const [errors, setErrors] = useState<BetFormErrors>({});

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
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: BetFormErrors = {};
    const parsedOdds = Number(odds);
    const parsedStake = Number(stake);

    if (!tournament.trim()) nextErrors.tournament = 'Укажите турнир.';
    if (!match.trim()) nextErrors.match = 'Укажите матч.';
    if (!selection.trim()) nextErrors.selection = 'Укажите выбранный исход.';
    if (!Number.isFinite(parsedOdds) || parsedOdds <= 1) nextErrors.odds = 'Коэффициент должен быть больше 1.';
    if (!Number.isFinite(parsedStake) || parsedStake < 0) nextErrors.stake = 'Сумма должна быть неотрицательной.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      date: date.trim() || today(),
      tournament: tournament.trim(),
      match: match.trim(),
      selection: selection.trim(),
      odds: parsedOdds,
      stake: parsedStake,
      stakeType,
      result,
    });
  };

  return <div className="bet-editor" role="presentation">
    <section ref={dialogRef} className="bet-editor__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="bet-editor__header">
        <div><span>Локальная запись</span><h2 id={titleId}>{bet ? 'Изменить ставку' : 'Добавить ставку'}</h2></div>
        <button ref={closeButtonRef} type="button" aria-label="Закрыть форму" onClick={onClose}><X size={18} /></button>
      </header>
      <form className="bet-editor__form" onSubmit={submit} noValidate>
        <label>Дата<input value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Турнир<input value={tournament} onChange={(event) => setTournament(event.target.value)} aria-invalid={Boolean(errors.tournament)} aria-describedby={errors.tournament ? 'bet-tournament-error' : undefined} />{errors.tournament ? <small id="bet-tournament-error">{errors.tournament}</small> : null}</label>
        <label>Матч<input value={match} onChange={(event) => setMatch(event.target.value)} aria-invalid={Boolean(errors.match)} aria-describedby={errors.match ? 'bet-match-error' : undefined} />{errors.match ? <small id="bet-match-error">{errors.match}</small> : null}</label>
        <label>Исход<input value={selection} onChange={(event) => setSelection(event.target.value)} aria-invalid={Boolean(errors.selection)} aria-describedby={errors.selection ? 'bet-selection-error' : undefined} />{errors.selection ? <small id="bet-selection-error">{errors.selection}</small> : null}</label>
        <div className="bet-editor__row">
          <label>Коэффициент<input type="number" min="1.01" step="0.01" inputMode="decimal" value={odds} onChange={(event) => setOdds(event.target.value)} aria-invalid={Boolean(errors.odds)} aria-describedby={errors.odds ? 'bet-odds-error' : undefined} />{errors.odds ? <small id="bet-odds-error">{errors.odds}</small> : null}</label>
          <label>Сумма<input type="number" min="0" step="1" inputMode="decimal" value={stake} onChange={(event) => setStake(event.target.value)} aria-invalid={Boolean(errors.stake)} aria-describedby={errors.stake ? 'bet-stake-error' : undefined} />{errors.stake ? <small id="bet-stake-error">{errors.stake}</small> : null}</label>
        </div>
        <div className="bet-editor__row">
          <label>Тип ставки<select value={stakeType} onChange={(event) => setStakeType(event.target.value as StakeType)}><option value="cash">Денежная</option><option value="freebet">Фрибет без возврата номинала</option></select></label>
          <label>Результат<select value={result} onChange={(event) => setResult(event.target.value as BetResult)}>{(Object.keys(resultLabels) as BetResult[]).map((value) => <option key={value} value={value}>{resultLabels[value]}</option>)}</select></label>
        </div>
        <p className="bet-editor__note">Прибыль рассчитывается автоматически. Для фрибета номинал не возвращается и не считается денежным оборотом.</p>
        <footer className="bet-editor__actions"><button type="button" onClick={onClose}>Отмена</button><button className="bet-editor__save" type="submit">{bet ? 'Сохранить изменения' : 'Добавить запись'}</button></footer>
      </form>
    </section>
  </div>;
}
