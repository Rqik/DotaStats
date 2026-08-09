import { useState } from 'react';
import { useBetStore } from '../bets/betStore';
import { selectPublicSettings, useSettingsStore } from '../settings/settingsStore';
import {
  createTransferDocument,
  downloadJsonFile,
  parseTransferDocument,
} from './dataTransfer';

export type TransferStatus =
  | { kind: 'idle'; message: '' }
  | { kind: 'success' | 'error'; message: string };

interface UseDataTransferResult {
  status: TransferStatus;
  exportData: (fileName: string) => void;
  importData: (file: File) => Promise<void>;
}

export function useDataTransfer(): UseDataTransferResult {
  const bets = useBetStore((state) => state.bets);
  const replaceBets = useBetStore((state) => state.replaceBets);
  const applyPublicSettings = useSettingsStore((state) => state.applyPublicSettings);
  const [status, setStatus] = useState<TransferStatus>({ kind: 'idle', message: '' });

  const exportData = (fileName: string) => {
    downloadJsonFile(fileName, createTransferDocument(bets, selectPublicSettings()));
    setStatus({ kind: 'success', message: 'Экспорт подготовлен. API-ключ в файл не включён.' });
  };

  const importData = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus({ kind: 'error', message: 'Не удалось прочитать выбранный файл.' });
      return;
    }

    const parsed = parseTransferDocument(text);
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.message });
      return;
    }

    const confirmed = window.confirm(`Импорт заменит ${bets.length} текущих записей на ${parsed.data.bets.length} записей из файла. Продолжить?`);
    if (!confirmed) {
      setStatus({ kind: 'idle', message: '' });
      return;
    }

    // Both stores are changed only after the complete document passes validation.
    await replaceBets(parsed.data.bets);
    const storageError = useBetStore.getState().error;
    if (storageError) {
      setStatus({
        kind: 'error',
        message: `Импорт отменён: ${storageError}`,
      });
      return;
    }
    applyPublicSettings(parsed.data.settings);
    setStatus({
      kind: 'success',
      message: `Импортировано ставок: ${parsed.data.bets.length}. Секретные настройки не принимались.`,
    });
  };

  return { status, exportData, importData };
}
