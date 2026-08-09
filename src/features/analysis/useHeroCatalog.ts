import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openDotaRepository,
  type CachedResult,
  type HeroOption,
} from '../../api/openDotaRepository';

interface HeroCatalogState {
  result: CachedResult<HeroOption[]> | null;
  loading: boolean;
  error: string;
}

interface UseHeroCatalogResult extends HeroCatalogState {
  retry: () => Promise<void>;
}

const initialState: HeroCatalogState = { result: null, loading: false, error: '' };

export function useHeroCatalog(enabled: boolean): UseHeroCatalogResult {
  const [state, setState] = useState<HeroCatalogState>(initialState);
  const requestId = useRef(0);
  const requestInFlight = useRef(false);

  const retry = useCallback(async () => {
    setState(initialState);
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    try {
      const result = await openDotaRepository.listHeroes();
      if (requestId.current === currentRequest) setState({ result, loading: false, error: '' });
    } catch {
      if (requestId.current === currentRequest) {
        setState((current) => ({
          ...current,
          loading: false,
          error: 'Не удалось загрузить каталог героев OpenDota. Повторите попытку.',
        }));
      }
    } finally {
      requestInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || state.result || state.error || requestInFlight.current) return undefined;
    requestInFlight.current = true;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    void openDotaRepository.listHeroes()
      .then((result) => {
        if (requestId.current === currentRequest) setState({ result, loading: false, error: '' });
      })
      .catch(() => {
        if (requestId.current === currentRequest) {
          setState((current) => ({
            ...current,
            loading: false,
            error: 'Не удалось загрузить каталог героев OpenDota. Повторите попытку.',
          }));
        }
      })
      .finally(() => {
        requestInFlight.current = false;
      });
    return undefined;
  }, [enabled, state.error, state.result]);

  useEffect(() => () => {
    requestId.current += 1;
  }, []);

  return {
    ...state,
    loading: enabled && !state.result && !state.error,
    retry,
  };
}
