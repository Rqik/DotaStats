import type { HeroOption } from '../api/openDotaRepository';
import { HeroIdentity } from '../components/HeroIdentity';
import type { LiveMatchSnapshot } from '../services/liveMatch';
import './LiveMatchPanel.scss';

interface LiveMatchPanelProps {
  match: LiveMatchSnapshot;
  heroes: HeroOption[];
  loadingHeroes: boolean;
  catalogError: string;
  onRetryCatalog: () => void;
  onUseDraft: () => void;
}

function formatTime(seconds: number | null): string {
  if (seconds === null) return 'не передано';
  const absolute = Math.abs(seconds);
  return `${seconds < 0 ? '−' : ''}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

export function LiveMatchPanel({ match, heroes, loadingHeroes, catalogError, onRetryCatalog, onUseDraft }: LiveMatchPanelProps) {
  const ageSeconds = match.updatedAt === null ? null : Math.max(0, Math.floor((match.fetchedAt - match.updatedAt) / 1000));
  const hasKnownHeroes = [...match.radiant.heroIds, ...match.dire.heroIds].every((id) => heroes.some((hero) => hero.heroId === id));
  const canUseDraft = match.isDraftComplete && hasKnownHeroes && !loadingHeroes && !catalogError;
  const teams = [{ side: 'radiant', team: match.radiant }, { side: 'dire', team: match.dire }];
  const heroesById = new Map(heroes.map((hero) => [hero.heroId, hero]));

  return <section className="live-match" aria-labelledby="live-match-title">
    <h3 id="live-match-title">Текущий матч #{match.matchId}</h3>
    <p className="live-match__source">Источник: OpenDota /live. Получено {new Date(match.fetchedAt).toLocaleTimeString('ru-RU')}. Время игры: {formatTime(match.gameTimeSeconds)}.</p>
    <p className="live-match__source">Задержка трансляции: {match.delaySeconds === null ? 'не указана' : `${match.delaySeconds} сек.`} Возраст снимка на момент загрузки: {ageSeconds === null ? 'не указан' : `${ageSeconds} сек.`}</p>
    {ageSeconds === null || ageSeconds > 300 ? <p className="live-match__warning" role="status">{ageSeconds === null ? 'Источник не передал время обновления.' : 'Снимок старше пяти минут.'} Текущий драфт мог измениться; обновите матч перед расчётом.</p> : null}
    <div className="live-match__teams">
      {teams.map(({ side, team }) => <section className={`live-match__team live-match__team--${side}`} key={side}>
        <h4>{team.name} <small>({side === 'radiant' ? 'Radiant' : 'Dire'})</small></h4>
        <p>Убийства: {team.score ?? 'не передано'} · пики: {team.heroIds.length} / 5</p>
        <ul>{team.players.map((player, index) => <li key={`${player.heroId}-${index}`}>
          <HeroIdentity hero={heroesById.get(player.heroId)} heroId={player.heroId} />
          <span className="live-match__nickname" title={player.name || 'Ник не передан'}>{player.name || 'Ник не передан'}</span>
        </li>)}</ul>
      </section>)}
    </div>
    {!match.isDraftComplete ? <p className="live-match__warning" role="status">Источник ещё не вернул десять уникальных пиков: по пять на сторону. Дождитесь окончания драфта и загрузите матч снова.</p> : null}
    {loadingHeroes ? <p role="status">Загружаем названия героев…</p> : null}
    {catalogError ? <p role="alert">{catalogError} <button type="button" onClick={onRetryCatalog}>Повторить загрузку героев</button></p> : null}
    {!loadingHeroes && !catalogError && !hasKnownHeroes ? <p role="alert">Не все герои найдены в каталоге. <button type="button" onClick={onRetryCatalog}>Обновить каталог героев</button></p> : null}
    <button className="live-match__import" type="button" disabled={!canUseDraft} onClick={onUseDraft}>Подставить драфт в анализ</button>
    <p className="live-match__source">Расчёт оценит составы по статистике героев. Текущие счёт, золото и время игры в модель вероятности не входят. Имена команд показываются только если их вернул источник.</p>
  </section>;
}
