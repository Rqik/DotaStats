import { Download, FileSpreadsheet, Pencil, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { PageHeading } from '../components/PageHeading';
import { roi } from '../domain/bankroll';
import { BetEditorModal } from '../features/bets/BetEditorModal';
import {
  formatMoney,
  useBetStore,
  type Bet,
  type BetDraft,
  type BetResult,
} from '../features/bets/betStore';
import { useDataTransfer } from '../features/data-transfer/useDataTransfer';
import { downloadBetsCsv } from '../features/data-transfer/betsCsv';
import './BetsJournal.scss';

const resultLabels: Record<BetResult, string> = {
  pending: 'Ожидает',
  win: 'Выигрыш',
  loss: 'Проигрыш',
  refund: 'Возврат',
};

type EditorState =
  | { mode: 'create'; returnFocusTo: HTMLElement }
  | { mode: 'edit'; bet: Bet; returnFocusTo: HTMLElement }
  | null;

export default function BetsJournal() {
  const bets = useBetStore((state) => state.bets);
  const hydrated = useBetStore((state) => state.hydrated);
  const loading = useBetStore((state) => state.loading);
  const storageError = useBetStore((state) => state.error);
  const retryHydration = useBetStore((state) => state.retryHydration);
  const createBet = useBetStore((state) => state.createBet);
  const updateBet = useBetStore((state) => state.updateBet);
  const deleteBet = useBetStore((state) => state.deleteBet);
  const settleBet = useBetStore((state) => state.settleBet);
  const { status, exportData, importData } = useDataTransfer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<'all' | BetResult>('all');
  const [editor, setEditor] = useState<EditorState>(null);

  const storageBusy = loading || !hydrated;
  const storageAvailable = !storageBusy && storageError === null;
  const canShowJournal = hydrated && !loading && (storageError === null || bets.length > 0);
  const visibleBets = useMemo(
    () => (filter === 'all' ? bets : bets.filter((bet) => bet.result === filter)),
    [bets, filter],
  );
  const settledBets = bets.filter((bet) => bet.result !== 'pending');
  const cashBets = settledBets.filter((bet) => bet.stakeType === 'cash');
  const cashProfit = cashBets.reduce((sum, bet) => sum + bet.profit, 0);
  const cashTurnover = cashBets.reduce((sum, bet) => sum + bet.stake, 0);
  const freebetProfit = settledBets
    .filter((bet) => bet.stakeType === 'freebet')
    .reduce((sum, bet) => sum + bet.profit, 0);

  const saveBet = (draft: BetDraft) => {
    if (editor?.mode === 'edit') void updateBet(editor.bet.id, draft);
    else void createBet(draft);
    setEditor(null);
  };

  const confirmDelete = (bet: Bet) => {
    const confirmed = window.confirm(
      `Удалить запись «${bet.selection}»? Это действие нельзя отменить.`,
    );
    if (confirmed) void deleteBet(bet.id);
  };

  const selectImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) await importData(file);
    event.target.value = '';
  };

  const retryStorage = () => {
    setEditor(null);
    void retryHydration();
  };

  return (
    <div className="bets-journal" aria-busy={storageBusy}>
      <PageHeading
        eyebrow="Локальный учёт"
        title="Журнал ставок"
        description="Записи хранятся локально в IndexedDB этого браузера и не отправляются на сервер. Статистика не является прогнозом."
        actions={(
          <button
            className="bets-journal__primary"
            type="button"
            disabled={!storageAvailable}
            onClick={(event) => setEditor({
              mode: 'create',
              returnFocusTo: event.currentTarget,
            })}
          >
            <Plus size={17} />
            Добавить запись
          </button>
        )}
      />
      {storageBusy ? (
        <section className="bets-journal__storage-state" role="status" aria-live="polite">
          <RefreshCw className="bets-journal__spinner" size={20} />
          <div>
            <strong>Загружаем локальный журнал…</strong>
            <p>Проверяем записи в IndexedDB. Пустой журнал будет показан только после загрузки.</p>
          </div>
        </section>
      ) : null}
      {storageError ? (
        <section
          className="bets-journal__storage-state bets-journal__storage-state--error"
          role="alert"
        >
          <div>
            <strong>Локальное хранилище недоступно</strong>
            <p>{storageError}</p>
            <p>Несохранённое изменение отменено. Проверьте доступ к данным сайта и повторите загрузку.</p>
          </div>
          <button type="button" onClick={retryStorage}>
            <RefreshCw size={16} />
            Повторить
          </button>
        </section>
      ) : null}
      {canShowJournal ? (
        <>
          <section className="bets-journal__summary" aria-label="Сводка журнала">
            <article><span>Денежная прибыль</span><strong>{cashProfit >= 0 ? '+' : ''}{formatMoney(cashProfit)}</strong></article>
            <article><span>Денежный оборот</span><strong>{formatMoney(cashTurnover)}</strong></article>
            <article><span>ROI денег</span><strong>{roi(cashProfit, cashTurnover).toFixed(1)}%</strong></article>
            <article><span>Прибыль фрибетов</span><strong>{freebetProfit >= 0 ? '+' : ''}{formatMoney(freebetProfit)}</strong></article>
          </section>
          <section className="bets-journal__panel">
            <div className="bets-journal__toolbar">
              <div className="bets-journal__filters" aria-label="Фильтр ставок">
                {(['all', 'pending', 'win', 'loss', 'refund'] as const).map((result) => (
                  <button
                    className={filter === result
                      ? 'bets-journal__filter bets-journal__filter--active'
                      : 'bets-journal__filter'}
                    type="button"
                    key={result}
                    onClick={() => setFilter(result)}
                    aria-pressed={filter === result}
                  >
                    {result === 'all' ? 'Все' : resultLabels[result]}
                  </button>
                ))}
              </div>
              <div className="bets-journal__tools">
                <button
                  type="button"
                  disabled={!storageAvailable}
                  onClick={() => exportData('dota-pulse-journal.json')}
                >
                  <Download size={15} />
                  Экспорт
                </button>
                <button
                  type="button"
                  disabled={!storageAvailable}
                  onClick={() => downloadBetsCsv('dota-pulse-journal.csv', bets)}
                >
                  <FileSpreadsheet size={15} />
                  CSV
                </button>
                <button
                  type="button"
                  disabled={!storageAvailable}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={15} />
                  Импорт
                </button>
                <input
                  className="bets-journal__file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  disabled={!storageAvailable}
                  onChange={selectImportFile}
                  aria-label="Выбрать JSON-файл для импорта"
                />
              </div>
            </div>
            {status.kind !== 'idle' && !(storageError && status.kind === 'success') ? (
              <p
                className={status.kind === 'error'
                  ? 'bets-journal__message bets-journal__message--error'
                  : 'bets-journal__message'}
                role={status.kind === 'error' ? 'alert' : 'status'}
              >
                {status.message}
              </p>
            ) : null}
            <div className="bets-journal__table">
              <table>
                <thead>
                  <tr>
                    <th>Матч</th><th>Исход</th><th>Тип</th><th>Коэф.</th><th>Сумма</th>
                    <th>Статус</th><th>Прибыль</th>
                    <th><span className="bets-journal__visually-hidden">Действия</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBets.map((bet) => (
                    <tr key={bet.id}>
                      <td data-label="Матч"><strong>{bet.match}</strong><small>{bet.tournament} · {bet.date}</small></td>
                      <td data-label="Исход">{bet.selection}</td>
                      <td data-label="Тип">{bet.stakeType === 'cash' ? 'Деньги' : 'Фрибет'}</td>
                      <td data-label="Коэффициент">{bet.odds.toFixed(2)}</td>
                      <td data-label="Сумма">{formatMoney(bet.stake)}</td>
                      <td data-label="Статус">
                        <select
                          aria-label={`Статус ставки ${bet.selection}`}
                          value={bet.result}
                          disabled={!storageAvailable}
                          onChange={(event) => void settleBet(
                            bet.id,
                            event.target.value as BetResult,
                          )}
                        >
                          {(Object.keys(resultLabels) as BetResult[]).map((result) => (
                            <option key={result} value={result}>{resultLabels[result]}</option>
                          ))}
                        </select>
                      </td>
                      <td
                        data-label="Прибыль"
                        className={bet.profit > 0
                          ? 'bets-journal__profit bets-journal__profit--positive'
                          : bet.profit < 0
                            ? 'bets-journal__profit bets-journal__profit--negative'
                            : 'bets-journal__profit'}
                      >
                        {bet.result === 'pending'
                          ? '—'
                          : `${bet.profit > 0 ? '+' : ''}${formatMoney(bet.profit)}`}
                      </td>
                      <td data-label="Действия">
                        <div className="bets-journal__row-actions">
                          <button
                            type="button"
                            disabled={!storageAvailable}
                            aria-label={`Изменить ставку ${bet.selection}`}
                            onClick={(event) => setEditor({
                              mode: 'edit',
                              bet,
                              returnFocusTo: event.currentTarget,
                            })}
                          >
                            <Pencil size={15} />
                            <span className="bets-journal__action-label">Изменить</span>
                          </button>
                          <button
                            className="bets-journal__delete"
                            type="button"
                            disabled={!storageAvailable}
                            aria-label={`Удалить ставку ${bet.selection}`}
                            onClick={() => confirmDelete(bet)}
                          >
                            <Trash2 size={15} />
                            <span className="bets-journal__action-label">Удалить</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleBets.length === 0 && storageError === null ? (
              <p className="bets-journal__empty">Нет записей с выбранным статусом.</p>
            ) : null}
          </section>
        </>
      ) : null}
      {editor ? (
        <BetEditorModal
          bet={editor.mode === 'edit' ? editor.bet : undefined}
          returnFocusTo={editor.returnFocusTo}
          onClose={() => setEditor(null)}
          onSubmit={saveBet}
        />
      ) : null}
    </div>
  );
}
