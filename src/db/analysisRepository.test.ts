import { describe, expect, it } from 'vitest';
import {
  AnalysisRepository,
  InvalidSavedAnalysisError,
  MemoryAnalysisStorage,
  normalizeSavedAnalysis,
  type SavedAnalysisV2Input,
} from './analysisRepository';

function handicapAnalysis(
  id: string,
  createdAt: number | string,
  title = 'Team A +5.5',
): SavedAnalysisV2Input {
  return {
    version: 2,
    state: 'success',
    id,
    mode: 'handicap',
    title,
    createdAt,
    summary: 'Расчётная вероятность 62%',
    source: 'network',
    status: 'statistical_edge',
    payload: {
      input: { selectedTeam: 'Team A', odds: 1.8, sample: 20 },
      result: { probability: 0.62, status: 'statistical_edge', edge: 0.064 },
    },
  };
}

describe('AnalysisRepository', () => {
  it('upserts successful v2 analyses, returns newest metadata and full reopening payload', async () => {
    const storage = new MemoryAnalysisStorage();
    const repository = new AnalysisRepository(storage);
    await repository.put(handicapAnalysis('older', 100));
    await repository.put(handicapAnalysis('newer', '2026-08-09T12:00:00.000Z'));
    await repository.put(handicapAnalysis('older', 100, 'Обновлённый заголовок'));

    const list = await repository.list(2);
    expect(list.invalidCount).toBe(0);
    expect(list.items.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(list.items[1]).toMatchObject({
      version: 2,
      title: 'Обновлённый заголовок',
      summary: 'Расчётная вероятность 62%',
      source: 'network',
      status: 'statistical_edge',
    });

    const reopened = await repository.get('newer');
    expect(reopened.invalid).toBe(false);
    expect(reopened.analysis?.createdAt).toBe(Date.parse('2026-08-09T12:00:00.000Z'));
    expect(reopened.analysis?.payload).toMatchObject({
      input: { selectedTeam: 'Team A', odds: 1.8 },
      result: { probability: 0.62, status: 'statistical_edge' },
    });
  });

  it('preserves valid v1 rows and normalizes ISO createdAt without rewriting them', async () => {
    const legacyPayload = { input: { team: 'Legacy' }, result: { probability: 0.5 } };
    const storage = new MemoryAnalysisStorage([{
      id: 'legacy-1',
      createdAt: '2025-01-02T03:04:05.000Z',
      title: 'Старый анализ',
      mode: 'draft',
      payload: legacyPayload,
    }]);
    const repository = new AnalysisRepository(storage);

    const result = await repository.get('legacy-1');
    expect(result).toEqual({
      invalid: false,
      analysis: {
        id: 'legacy-1',
        version: 1,
        createdAt: Date.parse('2025-01-02T03:04:05.000Z'),
        title: 'Старый анализ',
        mode: 'draft',
        summary: 'Старый анализ',
        source: 'legacy',
        status: 'legacy',
        payload: legacyPayload,
      },
    });
  });

  it('validates minimal draft and match mode envelopes independently', async () => {
    const repository = new AnalysisRepository(new MemoryAnalysisStorage());
    await repository.put({
      version: 2,
      state: 'success',
      id: 'draft-1',
      mode: 'draft',
      title: 'Team A — Team B',
      createdAt: 10,
      summary: 'Предварительный фаворит Team A',
      source: 'network',
      status: 'medium_confidence',
      payload: {
        input: { teamA: [1, 2, 3, 4, 5], teamB: [6, 7, 8, 9, 10] },
        result: { overallProbabilityA: 0.57 },
      },
    });
    await repository.put({
      version: 2,
      state: 'success',
      id: 'match-1',
      mode: 'match',
      title: 'Radiant — Dire',
      createdAt: 20,
      summary: 'Radiant победила 35:28',
      source: 'cache',
      status: 'parsed',
      payload: {
        input: '8936009381',
        result: { data: { matchId: 8936009381, winnerSide: 'radiant' } },
      },
    });

    const list = await repository.list();
    expect(list.items.map((item) => item.mode)).toEqual(['match', 'draft']);
    await expect(repository.get('draft-1')).resolves.toMatchObject({
      invalid: false,
      analysis: { payload: { result: { overallProbabilityA: 0.57 } } },
    });
  });

  it('ignores and reports corrupt rows instead of crashing the list or get flow', async () => {
    const corrupt = { ...handicapAnalysis('corrupt', 300), payload: { input: {}, result: { probability: 4 } } };
    const storage = new MemoryAnalysisStorage([handicapAnalysis('valid', 200), corrupt]);
    const repository = new AnalysisRepository(storage);

    await expect(repository.list()).resolves.toMatchObject({
      items: [{ id: 'valid' }],
      invalidCount: 1,
    });
    await expect(repository.get('corrupt')).resolves.toEqual({ analysis: null, invalid: true });
  });

  it('rejects non-success envelopes before storage and deletes by id', async () => {
    const storage = new MemoryAnalysisStorage();
    const repository = new AnalysisRepository(storage);
    const invalid = { ...handicapAnalysis('failed', 1), state: 'error' };
    expect(normalizeSavedAnalysis(invalid)).toBeNull();
    await expect(Reflect.apply(repository.put, repository, [invalid]))
      .rejects.toBeInstanceOf(InvalidSavedAnalysisError);

    await repository.put(handicapAnalysis('delete-me', 1));
    await repository.delete('delete-me');
    await expect(repository.get('delete-me')).resolves.toEqual({ analysis: null, invalid: false });
  });

  it('validates list limits', async () => {
    const repository = new AnalysisRepository(new MemoryAnalysisStorage());
    await expect(repository.list(-1)).rejects.toThrow(RangeError);
  });
});
