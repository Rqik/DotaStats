import { ApiError, type ApiErrorKind } from '../../api/client';

export interface AnalysisErrorDetails {
  kind: ApiErrorKind | 'unknown';
  message: string;
}

const messages: Record<ApiErrorKind, string> = {
  invalid_request: 'Проверьте исходные данные анализа.',
  not_found: 'Матч или команда не найдены в OpenDota.',
  rate_limit: 'OpenDota временно ограничила запросы. Повторите попытку позже.',
  timeout: 'OpenDota не ответила вовремя. Проверьте сеть и повторите попытку.',
  network: 'Не удалось подключиться к OpenDota. Проверьте сеть и повторите попытку.',
  invalid_schema: 'OpenDota вернула данные в неожиданном формате.',
  http: 'OpenDota временно недоступна. Повторите попытку позже.',
};

export function describeAnalysisError(error: unknown): AnalysisErrorDetails {
  if (error instanceof ApiError) {
    return { kind: error.kind, message: messages[error.kind] };
  }

  return {
    kind: 'unknown',
    message: 'Не удалось выполнить анализ. Повторите попытку.',
  };
}
