import { Database, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteApplicationData,
  inspectApplicationData,
  type ClearDataResult,
  type LocalDataInspection,
} from '../features/data-admin/dataAdminClient';
import './DataDeletionPanel.scss';

const confirmationText = 'УДАЛИТЬ';

interface DataDeletionPanelProps {
  onDeleted: (result: ClearDataResult) => void;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

export function DataDeletionPanel({ onDeleted }: DataDeletionPanelProps) {
  const [inspection, setInspection] = useState<LocalDataInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setError('');
    try {
      const nextInspection = await inspectApplicationData();
      if (requestId.current === currentRequest) setInspection(nextInspection);
    } catch {
      if (requestId.current === currentRequest) {
        setError('Не удалось прочитать сводку локальных данных. Данные не изменены.');
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void inspectApplicationData()
      .then((nextInspection) => {
        if (active) setInspection(nextInspection);
      })
      .catch(() => {
        if (active) setError('Не удалось прочитать сводку локальных данных. Данные не изменены.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, []);

  const deleteAll = async () => {
    if (confirmation !== confirmationText) return;
    setDeleting(true);
    setError('');
    setResultMessage('');
    try {
      const result = await deleteApplicationData();
      onDeleted(result);
      setInspection(null);
      setConfirmation('');
      setResultMessage(
        `Удалено записей IndexedDB: ${result.totalDeletedRecords}; ключей настроек: ${result.deletedLocalStorageKeys.length}.`,
      );
    } catch {
      setError('Не удалось удалить все данные. Состояние экранов не сброшено; повторите попытку.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="data-deletion" id="settings-data-deletion" aria-busy={loading || deleting}>
      <div className="data-deletion__heading">
        <div>
          <h2>Все локальные данные</h2>
          <p>Ставки, сохранённые анализы, кэш OpenDota и настройки этого браузера.</p>
        </div>
        <button type="button" disabled={loading || deleting} onClick={() => void refresh()}>
          <RefreshCw size={16} />
          Обновить сводку
        </button>
      </div>
      {loading ? <p className="data-deletion__status" role="status">Считаем локальные записи…</p> : null}
      {inspection ? (
        <dl className="data-deletion__summary">
          <div><dt>Ставки</dt><dd>{inspection.categories.bets.count}</dd></div>
          <div><dt>Анализы</dt><dd>{inspection.categories.analyses.count}</dd></div>
          <div><dt>Кэш</dt><dd>{inspection.categories.cache.count}</dd></div>
          <div><dt>Настройки</dt><dd>{inspection.categories.settings.count}</dd></div>
          <div><dt>Старые ключи ставок</dt><dd>{inspection.categories.legacyBets.count}</dd></div>
          <div><dt>Всего</dt><dd>{inspection.total.count} · {formatBytes(inspection.total.estimatedBytes)}</dd></div>
        </dl>
      ) : null}
      <div className="data-deletion__warning">
        <Trash2 size={20} />
        <div>
          <strong>Удаление нельзя отменить</strong>
          <p>Сначала сохраните JSON/CSV, если данные могут понадобиться. Введите «{confirmationText}» для подтверждения.</p>
          <label htmlFor="delete-all-confirmation">Подтверждение</label>
          <input
            id="delete-all-confirmation"
            value={confirmation}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <button
            className="data-deletion__delete"
            type="button"
            disabled={deleting || confirmation !== confirmationText}
            onClick={() => void deleteAll()}
          >
            <Database size={16} />
            {deleting ? 'Удаляем…' : 'Удалить все данные'}
          </button>
        </div>
      </div>
      {error ? <p className="data-deletion__message data-deletion__message--error" role="alert">{error}</p> : null}
      {resultMessage ? <p className="data-deletion__message" role="status">{resultMessage}</p> : null}
    </section>
  );
}
