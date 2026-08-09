import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import type { TournamentSelection } from '../features/team-picker/TournamentTeamSelection';
import { emptyDraftForm, type DraftFormValue } from '../features/analysis/draftForm';
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
import { DraftAnalysisForm } from './DraftAnalysisForm';
import type { AnalysisMode } from './analysisMode';
import './NewAnalysis.scss';

const emptyTournamentSelection: TournamentSelection = {
  league: null,
  teamA: null,
  teamB: null,
};

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
  const [mode, setMode] = useState<AnalysisMode>('handicap');
  const [tournamentSelection, setTournamentSelection] = useState<TournamentSelection>(
    emptyTournamentSelection,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [sign, setSign] = useState<HandicapSign>('plus');
  const [handicap, setHandicap] = useState('20.5');
  const [odds, setOdds] = useState('1.65');
  const [sample, setSample] = useState<AnalysisSampleSize>(20);
  const [draft, setDraft] = useState<DraftFormValue>(emptyDraftForm);
  const [draftTournamentSelection, setDraftTournamentSelection] = useState<TournamentSelection>(
    emptyTournamentSelection,
  );
  const [matchId, setMatchId] = useState('');
  const [formError, setFormError] = useState('');
  const heroCatalog = useHeroCatalog(mode === 'draft');

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
    : mode === 'match' ? matchState.status === 'loading' : draftState.status === 'loading';
  const requestError = mode === 'handicap' && handicapState.status === 'error'
    ? handicapState.message
    : mode === 'match' && matchState.status === 'error' && matchState.input === matchId
      ? matchState.message
      : mode === 'draft' && draftState.status === 'error'
        ? draftState.message
        : '';

  const changeMode = (nextMode: AnalysisMode) => {
    setMode(nextMode);
    setFormError('');
  };

  const changeTournamentSelection = (nextSelection: TournamentSelection) => {
    setTournamentSelection(nextSelection);
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
    const completed = await loadMatch(matchId);
    if (completed) navigate('/analysis/match/result');
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
    const hasDraftTeamA = draftTournamentSelection.teamA !== null;
    const hasDraftTeamB = draftTournamentSelection.teamB !== null;
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
        ...(draftTournamentSelection.teamA ? { teamId: draftTournamentSelection.teamA.teamId } : {}),
      },
      teamB: {
        name: draftTournamentSelection.teamB?.name || draft.teamBName.trim() || 'Команда B',
        side: draft.teamBSide,
        heroIds: draft.teamBHeroes.map((hero) => hero.heroId),
        ...(draftTournamentSelection.teamB ? { teamId: draftTournamentSelection.teamB.teamId } : {}),
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
      <form className="new-analysis__workspace" onSubmit={submit}>
        <section className="new-analysis__form">
          {mode === 'handicap' ? (
            <HandicapAnalysisForm
              tournamentSelection={tournamentSelection}
              selectedTeamId={selectedTeamId}
              sign={sign}
              handicap={handicap}
              odds={odds}
              sample={sample}
              onTournamentSelectionChange={changeTournamentSelection}
              onSelectedTeamChange={setSelectedTeamId}
              onSignChange={setSign}
              onHandicapChange={setHandicap}
              onOddsChange={setOdds}
              onSampleChange={setSample}
            />
          ) : null}
          {mode === 'match' ? (
            <MatchAnalysisForm
              matchId={matchId}
              error={formError && !validMatchId(matchId) ? formError : undefined}
              onMatchIdChange={changeMatchId}
            />
          ) : null}
          {mode === 'draft' ? (
            <DraftAnalysisForm
              value={draft}
              catalog={heroCatalog.result}
              loadingCatalog={heroCatalog.loading}
              catalogError={heroCatalog.error}
              tournamentSelection={draftTournamentSelection}
              onChange={(value) => {
                setDraft(value);
                setFormError('');
              }}
              onRetryCatalog={() => void heroCatalog.retry()}
              onTournamentSelectionChange={(selection) => {
                setDraftTournamentSelection(selection);
                setDraft((current) => ({
                  ...current,
                  teamAName: selection.teamA?.name ?? current.teamAName,
                  teamBName: selection.teamB?.name ?? current.teamBName,
                }));
                setFormError('');
              }}
            />
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
          canSubmit={canSubmit}
          isLoading={isLoading}
        />
      </form>
    </div>
  );
}
