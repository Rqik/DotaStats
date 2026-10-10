import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import {
  createTournamentPickerState,
  type TournamentPickerState,
} from '../features/team-picker/tournamentPickerState';
import type { DraftFormValue } from '../features/analysis/draftForm';
import type { AnalysisFormState } from '../features/analysis/analysisFormState';
import { useAnalysisFormStore } from '../features/analysis/analysisFormStore';
import { useLiveMatch } from '../features/analysis/useLiveMatch';
import { applyLiveDraft } from '../services/liveMatch';
import { useHeroCatalog } from '../features/analysis/useHeroCatalog';
import type { DraftAnalysisInput } from '../features/analysis/analysisClient';
import {
  useAnalysisStore,
  type AnalysisSampleSize,
  type HandicapSign,
} from '../stores/analysis';
import { AnalysisModes } from './AnalysisModes';
import { AnalysisSummary } from './AnalysisSummary';
import { HandicapAnalysisForm } from './HandicapAnalysisForm';
import { MatchAnalysisForm } from './MatchAnalysisForm';
import { LiveMatchPanel } from './LiveMatchPanel';
import { DraftAnalysisForm } from './DraftAnalysisForm';
import type { AnalysisMode } from './analysisMode';
import './NewAnalysis.scss';

function validMatchId(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const numericId = Number(value);
  return Number.isSafeInteger(numericId) && numericId > 0;
}

export default function NewAnalysis() {
  const navigate = useNavigate();
  const handicapState = useAnalysisStore((state) => state.handicap);
  const matchState = useAnalysisStore((state) => state.match);
  const draftState = useAnalysisStore((state) => state.draft);
  const runHandicap = useAnalysisStore((state) => state.runHandicap);
  const loadMatch = useAnalysisStore((state) => state.loadMatch);
  const runDraft = useAnalysisStore((state) => state.runDraft);
  const { mode, tournamentPicker, selectedTeamId, sign, handicap, odds, sample, draft, draftTournamentPicker, matchId, matchSource, draftOrigin } = useAnalysisFormStore((state) => state.form);
  const setField = useAnalysisFormStore((state) => state.setField);
  const isFormSaved = useAnalysisFormStore((state) => state.isFormSaved);
  const setMode = (value: AnalysisMode) => setField('mode', value);
  const setTournamentPicker = (value: TournamentPickerState) => setField('tournamentPicker', value);
  const setSelectedTeamId = (value: number | null | ((current: number | null) => number | null)) => setField('selectedTeamId', value);
  const setSign = (value: HandicapSign) => setField('sign', value);
  const setHandicap = (value: string) => setField('handicap', value);
  const setOdds = (value: string) => setField('odds', value);
  const setSample = (value: AnalysisSampleSize) => setField('sample', value);
  const setDraft = (value: DraftFormValue | ((current: DraftFormValue) => DraftFormValue)) => setField('draft', value);
  const setDraftTournamentPicker = (value: TournamentPickerState) => setField('draftTournamentPicker', value);
  const setMatchId = (value: string) => setField('matchId', value);
  const setMatchSource = (value: 'live' | 'completed') => setField('matchSource', value);
  const setDraftOrigin = (value: AnalysisFormState['draftOrigin']) => setField('draftOrigin', value);
  const [formError, setFormError] = useState('');
  const heroCatalog = useHeroCatalog(mode === 'draft' || (mode === 'match' && matchSource === 'live'));
  const liveMatch = useLiveMatch(matchId);

  const { selection: tournamentSelection } = tournamentPicker;
  const { selection: draftTournamentSelection } = draftTournamentPicker;
  const selectedTeam = [tournamentSelection.teamA, tournamentSelection.teamB]
    .find((team) => team?.teamId === selectedTeamId) ?? null;
  const handicapReady = Boolean(
    tournamentSelection.league
      && tournamentSelection.teamA
      && tournamentSelection.teamB
      && selectedTeam,
  );
  const draftHeroIds = [...draft.teamAHeroes, ...draft.teamBHeroes].map((hero) => hero.heroId);
  const draftReady = draft.teamAHeroes.length === 5
    && draft.teamBHeroes.length === 5
    && new Set(draftHeroIds).size === 10
    && Boolean(heroCatalog.result)
    && !heroCatalog.error;
  const canSubmit = mode === 'handicap'
    ? handicapReady
    : mode === 'match' ? validMatchId(matchId) : draftReady;
  const isLoading = mode === 'handicap'
    ? handicapState.status === 'loading'
    : mode === 'match' ? (matchSource === 'live' ? liveMatch.state.status === 'loading' : matchState.status === 'loading') : draftState.status === 'loading';
  const requestError = mode === 'handicap' && handicapState.status === 'error'
    ? handicapState.message
    : mode === 'match' && matchSource === 'live' && liveMatch.state.status === 'error'
      ? liveMatch.state.message
    : mode === 'match' && matchSource === 'completed' && matchState.status === 'error' && matchState.input === matchId
      ? matchState.message
      : mode === 'draft' && draftState.status === 'error'
        ? draftState.message
        : '';

  const changeMode = (nextMode: AnalysisMode) => {
    setMode(nextMode);
    setFormError('');
  };

  const changeTournamentPicker = (nextPicker: TournamentPickerState) => {
    setTournamentPicker(nextPicker);
    const { selection: nextSelection } = nextPicker;
    setSelectedTeamId((current) => {
      const currentIsValid = [nextSelection.teamA?.teamId, nextSelection.teamB?.teamId]
        .includes(current ?? -1);
      return currentIsValid ? current : nextSelection.teamA?.teamId ?? null;
    });
    setFormError('');
  };

  const changeMatchId = (value: string) => {
    setMatchId(value);
    setFormError('');
  };

  const submitHandicap = async (): Promise<void> => {
    const { league, teamA, teamB } = tournamentSelection;
    if (!league || !teamA || !teamB || teamA.teamId === teamB.teamId || !selectedTeam) {
      setFormError('Выберите выпуск турнира, две разные команды и анализируемую команду.');
      return;
    }

    const handicapValue = Number(handicap.replace(',', '.'));
    const oddsValue = Number(odds.replace(',', '.'));
    if (!Number.isFinite(handicapValue) || handicapValue < 0) {
      setFormError('Фора должна быть неотрицательным числом.');
      return;
    }
    if (!Number.isFinite(oddsValue) || oddsValue <= 1) {
      setFormError('Коэффициент должен быть числом строго больше 1.');
      return;
    }

    const completed = await runHandicap({
      leagueId: league.leagueId,
      leagueName: league.name,
      teamAId: teamA.teamId,
      teamA: teamA.name,
      teamBId: teamB.teamId,
      teamB: teamB.name,
      selectedTeamId: selectedTeam.teamId,
      selectedTeam: selectedTeam.name,
      sign,
      handicap: handicapValue,
      odds: oddsValue,
      sample,
    });
    if (completed) navigate('/analysis/result');
  };

  const submitMatch = async (): Promise<void> => {
    if (!validMatchId(matchId)) {
      setFormError('Match ID должен быть положительным целым числом, состоящим только из цифр.');
      return;
    }
    if (matchSource === 'live') {
      await liveMatch.load();
      return;
    }
    const completed = await loadMatch(matchId);
    if (completed) navigate('/analysis/match/result');
  };

  const importLiveDraft = () => {
    if (liveMatch.state.status !== 'success' || liveMatch.state.result.status !== 'found' || !heroCatalog.result) return;
    const { match } = liveMatch.state.result;
    try {
      const nextDraft = applyLiveDraft(match, heroCatalog.result.data, draft);
      setDraft(nextDraft);
      setDraftTournamentPicker(createTournamentPickerState());
      setDraftOrigin({ matchId: match.matchId, fetchedAt: match.fetchedAt, teamAId: match.radiant.teamId, teamBId: match.dire.teamId });
      setMode('draft');
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось перенести драфт. Обновите матч и каталог героев.');
    }
  };

  const submitDraft = async (): Promise<void> => {
    const allHeroIds = [...draft.teamAHeroes, ...draft.teamBHeroes].map((hero) => hero.heroId);
    if (draft.teamAHeroes.length !== 5 || draft.teamBHeroes.length !== 5 || new Set(allHeroIds).size !== 10) {
      setFormError('Выберите ровно десять уникальных героев: по пять для каждой команды.');
      return;
    }
    if (draft.teamASide === draft.teamBSide) {
      setFormError('Команды должны находиться на разных сторонах Radiant и Dire.');
      return;
    }
    const hasImportedTeams = Boolean(draftOrigin?.teamAId && draftOrigin.teamBId && draftOrigin.teamAId !== draftOrigin.teamBId);
    const draftTeamAId = draftTournamentSelection.teamA?.teamId ?? (hasImportedTeams ? draftOrigin?.teamAId : null);
    const draftTeamBId = draftTournamentSelection.teamB?.teamId ?? (hasImportedTeams ? draftOrigin?.teamBId : null);
    const hasDraftTeamA = Boolean(draftTeamAId);
    const hasDraftTeamB = Boolean(draftTeamBId);
    if (hasDraftTeamA !== hasDraftTeamB) {
      setFormError('Для учёта формы выберите обе реальные команды либо очистите необязательный выбор.');
      return;
    }

    const parseOdds = (value: string): number | undefined => {
      if (!value.trim()) return undefined;
      return Number(value.replace(',', '.'));
    };
    const teamAOdds = parseOdds(draft.teamAOdds);
    const teamBOdds = parseOdds(draft.teamBOdds);
    if ((teamAOdds !== undefined && (!Number.isFinite(teamAOdds) || teamAOdds <= 1))
      || (teamBOdds !== undefined && (!Number.isFinite(teamBOdds) || teamBOdds <= 1))) {
      setFormError('Каждый указанный коэффициент должен быть числом строго больше 1.');
      return;
    }

    const handicapLine = draft.handicapTeam === 'none'
      ? undefined
      : Number(draft.handicapLine.replace(',', '.'));
    if (draft.handicapTeam !== 'none' && (draft.handicapLine.trim() === '' || !Number.isFinite(handicapLine))) {
      setFormError('Укажите числовую фору со знаком, например −5.5 или +5.5.');
      return;
    }

    const odds = teamAOdds !== undefined || teamBOdds !== undefined
      ? { ...(teamAOdds !== undefined ? { teamA: teamAOdds } : {}), ...(teamBOdds !== undefined ? { teamB: teamBOdds } : {}) }
      : undefined;
    const input: DraftAnalysisInput = {
      teamA: {
        name: draftTournamentSelection.teamA?.name || draft.teamAName.trim() || 'Команда A',
        side: draft.teamASide,
        heroIds: draft.teamAHeroes.map((hero) => hero.heroId),
        ...(draftTeamAId ? { teamId: draftTeamAId } : {}),
      },
      teamB: {
        name: draftTournamentSelection.teamB?.name || draft.teamBName.trim() || 'Команда B',
        side: draft.teamBSide,
        heroIds: draft.teamBHeroes.map((hero) => hero.heroId),
        ...(draftTeamBId ? { teamId: draftTeamBId } : {}),
      },
      ...(odds ? { odds } : {}),
      ...(draft.handicapTeam !== 'none' && handicapLine !== undefined
        ? { handicap: { team: draft.handicapTeam, signedLine: handicapLine } }
        : {}),
    };
    const completed = await runDraft(input);
    if (completed) navigate('/analysis/draft/result');
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError('');
    if (mode === 'handicap') {
      await submitHandicap();
      return;
    }
    if (mode === 'match') {
      await submitMatch();
      return;
    }
    await submitDraft();
  };

  return (
    <div className="new-analysis">
      <PageHeading
        eyebrow="Новый расчёт"
        title="Что будем анализировать?"
        description="Выберите сценарий и укажите исходные данные. Результат покажет источник, формулу и ограничения данных."
      />
      <AnalysisModes mode={mode} onChange={changeMode} />
      <p className="new-analysis__save-status" role="status">{isFormSaved
        ? 'Выбор и параметры сохраняются в этом браузере.'
        : 'Браузер не разрешил сохранение формы. После перезагрузки выбор может сброситься.'}</p>
      <form className="new-analysis__workspace" onSubmit={submit}>
        <section className="new-analysis__form">
          <div hidden={mode !== 'handicap'}>
            <HandicapAnalysisForm
              tournamentPicker={tournamentPicker}
              selectedTeamId={selectedTeamId}
              sign={sign}
              handicap={handicap}
              odds={odds}
              sample={sample}
              onTournamentPickerChange={changeTournamentPicker}
              onSelectedTeamChange={setSelectedTeamId}
              onSignChange={setSign}
              onHandicapChange={setHandicap}
              onOddsChange={setOdds}
              onSampleChange={setSample}
            />
          </div>
          {mode === 'match' ? (
            <MatchAnalysisForm
              matchId={matchId}
              source={matchSource}
              error={formError && !validMatchId(matchId) ? formError : undefined}
              onMatchIdChange={changeMatchId}
              onSourceChange={(source) => { setMatchSource(source); setFormError(''); }}
            />
          ) : null}
          {mode === 'match' && matchSource === 'live' && liveMatch.state.status === 'success' ? (
            liveMatch.state.result.status === 'found'
              ? <LiveMatchPanel match={liveMatch.state.result.match} heroes={heroCatalog.result?.data ?? []} loadingHeroes={heroCatalog.loading} catalogError={heroCatalog.error} onRetryCatalog={() => void heroCatalog.retry()} onUseDraft={importLiveDraft} />
              : <p className="new-analysis__save-status" role="status">Матч #{matchId} не найден среди {liveMatch.state.result.searchedMatches} игр live-списка OpenDota. Это не означает, что он завершён. Повторите загрузку позже или выберите героев вручную в режиме драфта.</p>
          ) : null}
          {mode === 'draft' ? (
            <>
            <p className="new-analysis__save-status">{draftOrigin
              ? `Драфт матча #${draftOrigin.matchId}, получен ${new Date(draftOrigin.fetchedAt).toLocaleString('ru-RU')}. Модель учитывает составы и доступную историю команд, а текущий счёт и золото в неё не входят.`
              : 'Герои и команды задаются вручную.'}</p>
            <DraftAnalysisForm
              value={draft}
              sourceMatchId={draftOrigin?.matchId}
              catalog={heroCatalog.result}
              loadingCatalog={heroCatalog.loading}
              catalogError={heroCatalog.error}
              tournamentPicker={draftTournamentPicker}
              onChange={(value) => {
                const isCompositionChanged = value.teamAHeroes !== draft.teamAHeroes || value.teamBHeroes !== draft.teamBHeroes
                  || value.teamAName !== draft.teamAName || value.teamBName !== draft.teamBName
                  || value.teamASide !== draft.teamASide || value.teamBSide !== draft.teamBSide;
                setDraft(value);
                if (isCompositionChanged) setDraftOrigin(null);
                setFormError('');
              }}
              onRetryCatalog={() => void heroCatalog.retry()}
              onTournamentPickerChange={(picker) => {
                setDraftTournamentPicker(picker);
                const isSelectionChanged = picker.selection.league?.leagueId !== draftTournamentSelection.league?.leagueId
                  || picker.selection.teamA?.teamId !== draftTournamentSelection.teamA?.teamId
                  || picker.selection.teamB?.teamId !== draftTournamentSelection.teamB?.teamId;
                if (isSelectionChanged) setDraftOrigin(null);
                const { selection } = picker;
                setDraft((current) => ({
                  ...current,
                  teamAName: selection.teamA?.name ?? current.teamAName,
                  teamBName: selection.teamB?.name ?? current.teamBName,
                }));
                setFormError('');
              }}
            />
            </>
          ) : null}
          {formError && (mode !== 'match' || validMatchId(matchId)) ? (
            <p className="new-analysis__error" role="alert">{formError}</p>
          ) : null}
          {requestError ? (
            <p className="new-analysis__error" role="alert">{requestError}</p>
          ) : null}
        </section>
        <AnalysisSummary
          mode={mode}
          teamA={tournamentSelection.teamA?.name ?? ''}
          teamB={tournamentSelection.teamB?.name ?? ''}
          selectedTeam={selectedTeam?.name ?? ''}
          sign={sign}
          handicap={handicap}
          odds={odds}
          sample={String(sample)}
          selectedHeroCount={draftHeroIds.length}
          matchId={matchId}
          matchSource={matchSource}
          canSubmit={canSubmit}
          isLoading={isLoading}
        />
      </form>
    </div>
  );
}
