import { Database, Download, ShieldCheck, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { useBetStore } from '../features/bets/betStore';
import { useDataTransfer } from '../features/data-transfer/useDataTransfer';
import { checkOpenDotaStatus, clearOpenDotaCache } from '../features/settings/openDotaActions';
import { useSettingsStore } from '../features/settings/settingsStore';
import { useAnalysisStore } from '../stores/analysis';
import { DataDeletionPanel } from './DataDeletionPanel';
import './SettingsPage.scss';

export default function SettingsPage() {
  const navigate = useNavigate();
  const apiKey = useSettingsStore((state) => state.apiKey);
  const autoRefresh = useSettingsStore((state) => state.autoRefresh);
  const showCacheAge = useSettingsStore((state) => state.showCacheAge);
  const setApiKey = useSettingsStore((state) => state.setApiKey);
  const setAutoRefresh = useSettingsStore((state) => state.setAutoRefresh);
  const setShowCacheAge = useSettingsStore((state) => state.setShowCacheAge);
  const { status, exportData, importData } = useDataTransfer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiStatus, setApiStatus] = useState('Статус API ещё не проверен.');
  const [checkingApi, setCheckingApi] = useState(false);
  const [cacheStatus, setCacheStatus] = useState('Кэш содержит данные OpenDota, сохранённые в IndexedDB.');
  const [clearingCache, setClearingCache] = useState(false);

  const selectImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) await importData(file);
    event.target.value = '';
  };

  const checkApi = async () => {
    setCheckingApi(true);
    setApiStatus('Проверяем OpenDota…');
    try {
      const result = await checkOpenDotaStatus();
      const source = result.source === 'network' ? 'сеть OpenDota' : result.source === 'cache' ? 'свежий кэш' : 'устаревший кэш';
      setApiStatus(`OpenDota доступна: найдено лиг ${result.leagues}, источник — ${source}.`);
    } catch {
      setApiStatus('OpenDota недоступна. Проверьте сеть, API-ключ или лимит запросов.');
    } finally {
      setCheckingApi(false);
    }
  };

  const clearCache = async () => {
    const confirmed = window.confirm('Очистить весь локальный кэш OpenDota? Ставки и настройки останутся без изменений.');
    if (!confirmed) return;
    setClearingCache(true);
    setCacheStatus('Очищаем кэш OpenDota…');
    try {
      const deleted = await clearOpenDotaCache();
      setCacheStatus(`Удалено записей кэша: ${deleted}. Ставки и настройки сохранены.`);
    } catch {
      setCacheStatus('Не удалось очистить кэш. Данные не обозначены как удалённые.');
    } finally {
      setClearingCache(false);
    }
  };

  const resetAfterDeletion = () => {
    useBetStore.setState({ bets: [], hydrated: true, loading: false, error: null });
    useAnalysisStore.getState().resetAll();
    useSettingsStore.setState({ apiKey: '', autoRefresh: true, showCacheAge: true });
    void useSettingsStore.persist.clearStorage();
    navigate('/settings', { replace: true });
  };

  return <div className="settings-page">
    <PageHeading eyebrow="Параметры" title="Настройки" description="Источник данных, локальное хранилище и параметры интерфейса." />
    <div className="settings-page__layout">
      <nav className="settings-page__nav" aria-label="Разделы настроек">
        <a className="settings-page__nav-item settings-page__nav-item--active" href="#settings-data-source"><Database size={16} />Источник данных</a>
        <a className="settings-page__nav-item" href="#settings-data-transfer"><ShieldCheck size={16} />Перенос данных</a>
        <a className="settings-page__nav-item" href="#settings-data-deletion"><Database size={16} />Удаление данных</a>
      </nav>
      <div className="settings-page__content">
        <section className="settings-page__section" id="settings-data-source">
          <h2>OpenDota API</h2>
          <p>Ключ необязателен; frontend-ключ доступен владельцу браузера, хранится только локально и не попадает в экспорт.</p>
          <label>API-ключ<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Локальный API-ключ" autoComplete="off" /></label>
          <div className="settings-page__api-status"><small role="status">{apiStatus}</small><button type="button" onClick={() => void checkApi()} disabled={checkingApi}>{checkingApi ? 'Проверяем…' : 'Проверить соединение'}</button></div>
        </section>
        <section className="settings-page__section">
          <h2>Обновление данных</h2>
          <label className="settings-page__setting"><span><strong>Автоматически обновлять команды</strong><small>Не чаще одного раза в час</small></span><input aria-label="Автоматически обновлять команды" type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /></label>
          <label className="settings-page__setting"><span><strong>Показывать возраст кэша</strong><small>Например: данные сохранены 6 часов назад</small></span><input aria-label="Показывать возраст кэша" type="checkbox" checked={showCacheAge} onChange={(event) => setShowCacheAge(event.target.checked)} /></label>
          <div className="settings-page__cache"><span><Database size={18} /><span><strong>Локальный кэш</strong><small id="cache-clear-status" role="status">{cacheStatus}</small></span></span><button type="button" disabled={clearingCache} aria-describedby="cache-clear-status" onClick={() => void clearCache()}>{clearingCache ? 'Очищаем…' : 'Очистить кэш'}</button></div>
        </section>
        <section className="settings-page__section" id="settings-data-transfer">
          <h2>Перенос данных</h2>
          <p>Файл содержит ставки и несекретные настройки. Перед импортом весь документ проверяется; при ошибке данные не меняются.</p>
          <div className="settings-page__actions">
            <button type="button" onClick={() => exportData('dota-pulse-data.json')}><Download size={18} /><span><strong>Экспорт JSON</strong><small>Ставки и несекретные настройки</small></span></button>
            <button type="button" onClick={() => fileInputRef.current?.click()}><Upload size={18} /><span><strong>Импорт JSON</strong><small>С атомарной Zod-проверкой</small></span></button>
            <input className="settings-page__file-input" ref={fileInputRef} type="file" accept="application/json,.json" onChange={selectImportFile} aria-label="Выбрать JSON-файл для импорта" />
          </div>
          {status.kind !== 'idle' ? <p className={status.kind === 'error' ? 'settings-page__message settings-page__message--error' : 'settings-page__message'} role={status.kind === 'error' ? 'alert' : 'status'}>{status.message}</p> : null}
        </section>
        <DataDeletionPanel onDeleted={resetAfterDeletion} />
      </div>
    </div>
  </div>;
}
