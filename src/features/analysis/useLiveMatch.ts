import { useEffect, useRef, useState } from 'react';
import { loadLiveMatch, type LiveMatchLookup } from '../../services/liveMatch';
import { describeAnalysisError } from './analysisErrors';

type LiveMatchState =
  | { status: 'idle' }
  | { status: 'loading'; input: string }
  | { status: 'success'; input: string; result: LiveMatchLookup }
  | { status: 'error'; input: string; message: string };

export function useLiveMatch(matchId: string) {
  const [state, setState] = useState<LiveMatchState>({ status: 'idle' });
  const requestId = useRef(0);
  const isInFlight = useRef(false);

  useEffect(() => {
    requestId.current += 1;
    isInFlight.current = false;
    return () => { requestId.current += 1; };
  }, [matchId]);

  const load = async () => {
    if (isInFlight.current) return;
    isInFlight.current = true;
    const currentRequest = ++requestId.current;
    setState({ status: 'loading', input: matchId });
    try {
      const result = await loadLiveMatch(matchId);
      if (requestId.current === currentRequest) setState({ status: 'success', input: matchId, result });
    } catch (error) {
      if (requestId.current === currentRequest) setState({ status: 'error', input: matchId, message: describeAnalysisError(error).message });
    } finally {
      if (requestId.current === currentRequest) isInFlight.current = false;
    }
  };

  const visibleState: LiveMatchState = state.status === 'idle' || state.input === matchId ? state : { status: 'idle' };
  return { state: visibleState, load };
}
