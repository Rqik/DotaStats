import {
  openDotaRepository,
  type CachedResult,
} from '../../api/openDotaRepository';

export interface OpenDotaStatus {
  leagues: number;
  source: CachedResult<unknown>['source'];
  savedAt: number;
}

export async function checkOpenDotaStatus(): Promise<OpenDotaStatus> {
  const result = await openDotaRepository.listLeagues({ forceRefresh: true });
  return { leagues: result.data.length, source: result.source, savedAt: result.savedAt };
}

export async function clearOpenDotaCache(): Promise<number> {
  const result = await openDotaRepository.clearCache();
  return result.deleted;
}
