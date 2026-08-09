import {
  clearAllData,
  inspectLocalData,
  type ClearDataResult,
  type LocalDataInspection,
} from '../../db/dataAdministration';

export type { ClearDataResult, LocalDataInspection } from '../../db/dataAdministration';

export function inspectApplicationData(): Promise<LocalDataInspection> {
  return inspectLocalData();
}

export function deleteApplicationData(): Promise<ClearDataResult> {
  return clearAllData();
}
