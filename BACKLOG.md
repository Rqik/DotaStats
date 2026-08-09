# Dota Pulse — backlog реализации

Этот файл — единый список незавершённой функциональности. Координатор обновляет статусы после фактической проверки; `done` ставится только после QA.

Статусы: `todo`, `in progress`, `review`, `qa`, `done`, `blocked`.

## P0 — пользовательские сценарии, которые сейчас выглядят работающими

| ID | Задача | Владелец | Статус | Критерий приёмки |
| --- | --- | --- | --- | --- |
| DP-001 | Browser CORS smoke OpenDota | API/data | done | Chrome 151 из `file://` получил 200 для `/leagues`, `/teams`, `/leagues/65006/teams`, `/teams/7/matches`, `/matches/1967821024`, `/heroStats`; доказательство: `artifacts/opendota-cors-smoke.png` |
| DP-002 | Типизированный OpenDota repository | API/data | done | Методы leagues, league teams, teams, team matches, match и heroes валидируются Zod; фактические array-формы расхождений OpenAPI v31.1.0 покрыты contract-тестами |
| DP-003 | Dexie v2 и TTL-кэш | API/data | done | Добавлены целевые таблицы, нормализация v1→v2, cache metadata, force refresh, stale fallback, in-flight dedup, лимит match-запросов и browser migration QA |
| DP-004 | Выбор турнира и команд | Frontend | done | QA выбрал `The International 2024` и две реальные команды keyboard-only; loading/empty/error/cache age и mobile проверены |
| DP-005 | Реальный анализ форы | API/data + Frontend | done | QA проверил TI 2024 на реальных выборках 10/10/10, ручную формулу строк, H2H/веса, cache/error/insufficient/export/save |
| DP-006 | Полный CRUD журнала ставок | Frontend | done | QA проверил create/edit/delete, cash/freebet, settle, фильтры, валидацию, ROI и reload persistence |
| DP-007 | Хранение ставок в IndexedDB | API/data + Frontend | done | QA проверил пустой профиль, CRUD/reload/new tab, legacy migration, seed filtering, rollback, error/retry и import roundtrip |

## P1 — остальные видимые заглушки

| ID | Задача | Владелец | Статус | Критерий приёмки |
| --- | --- | --- | --- | --- |
| DP-008 | Анализ по Match ID | API/data + Frontend | done | QA проверил parsed match 8936009381, игроков, picks/bans, счёт, победителя, gold/xp charts, cache/warnings/errors/export |
| DP-009 | Ручной драфт | API/data + Frontend | review | Каталог и 10 уникальных героев связаны с реальными duration/matchup данными; формула 70/30 или 55/25/20, coverage/confidence, интервалы, кэш и ограничения покрыты тестами; объединённые gates PASS, требуется QA браузерного потока |
| DP-010 | Настройки OpenDota | Frontend + API/data | done | QA проверил versioned settings, API status, persistence и исключение API key из экспорта |
| DP-011 | Очистка кэша и удаление данных | API/data + Frontend | review | Кнопки показывают подтверждение и точный объём; очищают только заявленные данные |
| DP-012 | Экспорт/импорт JSON | Frontend + API/data | done | QA проверил download, собственный roundtrip, invalid JSON/schema без изменений и исключение секретов |
| DP-013 | Экспорт результата анализа | Frontend | done | QA проверил input, формулу, выборку, source `demonstration_sample` и disclaimer |
| DP-014 | Dashboard без фиктивной статистики | Frontend | review | Метрики, последние анализы и ставки строятся из локальных данных; hardcoded historical summary удалён |
| DP-015 | Help/notifications/profile actions | Frontend | review | Либо реализованы понятные панели, либо элементы удалены/честно disabled с объяснением |

## P2 — качество и завершение

| ID | Задача | Владелец | Статус | Критерий приёмки |
| --- | --- | --- | --- | --- |
| DP-016 | React Testing Library | Frontend/QA | todo | Покрыты team picker, формы ставок, settings, loading/error/empty и handoff результата |
| DP-017 | Project-local Playwright | QA | todo | Desktop/mobile E2E для team selection→analysis→save bet, CRUD, import/export, reload persistence |
| DP-018 | Финальная доступность и responsive QA | QA | todo | Keyboard/screen reader semantics, focus, contrast, 390/620/1024+, console errors и horizontal overflow |
| DP-019 | Финальная проверка честности данных | QA | todo | Ни одна mock/seed величина не обозначена как real API result; источник и возраст данных видны |

## P1 — требования ТЗ, добавленные после аудита полного потока

| ID | Задача | Владелец | Статус | Критерий приёмки |
| --- | --- | --- | --- | --- |
| DP-020 | История анализов в IndexedDB | API/data + Frontend | review | Успешные handicap/draft/match анализы сохраняются, открываются после reload и отображаются на Dashboard без mock |
| DP-021 | Экспорт ставок CSV | Frontend | review | CSV скачивается в UTF-8, содержит заголовки и все ставки, значения корректно экранированы |
| DP-022 | Полные поля ставки и расширенная статистика | Frontend + API/data | todo | Team A/B, market, handicap, bookmaker/comment/analysisId; банк, average odds, drawdown, market/team/freebet breakdown без фиктивных данных |

## Текущий цикл

1. API/data реализует draft DP-009: hero matchups/durations и прозрачную формулу.
2. Persistence-агент реализует историю анализов и безопасное полное удаление данных DP-011/DP-020.
3. Frontend подключает draft, реальный Dashboard, CSV и убирает оставшиеся no-op actions DP-009/DP-014/DP-015/DP-021.
4. Координатор объединяет контракты и выполняет review.
5. QA проверяет объединённое состояние; дефекты возвращаются владельцам.
6. Финальный цикл закрывает полную модель ставок DP-022 и тестовую инфраструктуру DP-016–DP-019.
