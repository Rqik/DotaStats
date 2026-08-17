import { describe, expect, it } from 'vitest';
import { describeHandicapMargin } from './HandicapMatchesTable';

describe('handicap margin presentation', () => {
  it('turns a negative decimal margin into whole kills needed to win', () => {
    expect(describeHandicapMargin(-47.5, 'loss')).toEqual({
      primary: 'Не хватило 48 убийств',
      detail: 'Итог линии −47.5',
    });
  });

  it('describes wins and integer-line refunds without changing settlement', () => {
    expect(describeHandicapMargin(1.5, 'win')).toEqual({ primary: 'Запас +1.5', detail: 'Линия пройдена' });
    expect(describeHandicapMargin(0, 'refund')).toEqual({ primary: 'Ровно по линии', detail: 'Для выигрыша нужно ещё 1 убийство' });
  });
});
