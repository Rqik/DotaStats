import { Database, Download, ShieldCheck, Upload } from 'lucide-react';
import { useState } from 'react';
import { PageHeading } from '../components/PageHeading';
import './SettingsPage.scss';

export default function SettingsPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCacheAge, setShowCacheAge] = useState(true);

  return <div className="settings-page">
    <PageHeading eyebrow="Параметры" title="Настройки" description="Источник данных, локальное хранилище и параметры интерфейса." />
    <div className="settings-page__layout">
      <nav className="settings-page__nav" aria-label="Разделы настроек">
        <button className="settings-page__nav-item settings-page__nav-item--active" type="button"><Database size={16} />Источник данных</button>
        <button className="settings-page__nav-item" type="button"><ShieldCheck size={16} />Анализ</button>
      </nav>
      <div className="settings-page__content">
        <section className="settings-page__section">
          <h2>OpenDota API</h2>
          <p>Ключ необязателен; frontend-ключ доступен владельцу браузера и не попадает в экспорт.</p>
          <label>API-ключ<input type="password" placeholder="Локальный API-ключ" /></label>
          <small>Пока реальные ответы OpenDota не подключены к экранам, используется честный демонстрационный fallback.</small>
        </section>
        <section className="settings-page__section">
          <h2>Обновление данных</h2>
          <label className="settings-page__setting"><span><strong>Автоматически обновлять команды</strong><small>Не чаще одного раза в час</small></span><input aria-label="Автоматически обновлять команды" type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /></label>
          <label className="settings-page__setting"><span><strong>Показывать возраст кэша</strong><small>Например: данные сохранены 6 часов назад</small></span><input aria-label="Показывать возраст кэша" type="checkbox" checked={showCacheAge} onChange={(event) => setShowCacheAge(event.target.checked)} /></label>
          <div className="settings-page__cache"><span><Database size={18} /><strong>Локальный кэш</strong></span><button type="button">Очистить кэш</button></div>
        </section>
        <section className="settings-page__section">
          <h2>Перенос данных</h2>
          <div className="settings-page__actions"><button type="button"><Download size={18} /><span><strong>Экспорт JSON</strong><small>Все данные и настройки</small></span></button><button type="button"><Upload size={18} /><span><strong>Импорт JSON</strong><small>С проверкой структуры</small></span></button></div>
        </section>
      </div>
    </div>
  </div>;
}
