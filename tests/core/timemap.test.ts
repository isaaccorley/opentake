import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TimeMap } from '../../src/core/timemap';

describe('TimeMap', () => {
  it('maps kept ranges and speed exactly', () => {
    const map = new TimeMap(
      [
        { start: 0, end: 2 },
        { start: 5, end: 9 },
      ],
      [{ start: 1, end: 6, rate: 2 }],
    );
    expect(map.toOutput(1)).toBeCloseTo(1);
    expect(map.toOutput(2)).toBeCloseTo(1.5);
    expect(map.toOutput(5)).toBeCloseTo(1.5);
    expect(map.toSource(map.toOutput(8))).toBeCloseTo(8);
    expect(() => map.toOutput(3)).toThrow();
  });

  it('has an exact inverse over generated retained source times', () => {
    const ranges = [
      { start: 0, end: 3 },
      { start: 5, end: 8 },
    ];
    const map = new TimeMap(ranges, [{ start: 1, end: 7, rate: 1.75 }]);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 8, noNaN: true }), (tau) => {
        fc.pre((tau <= 3 || tau >= 5) && tau <= 8);
        expect(
          Math.abs(map.toSource(map.toOutput(tau)) - tau),
        ).toBeLessThanOrEqual(1e-9);
      }),
    );
  });

  it('rejects ambiguous inputs before building the map', () => {
    expect(
      () =>
        new TimeMap(
          [
            { start: 2, end: 4 },
            { start: 3, end: 5 },
          ],
          [],
        ),
    ).toThrow(/sorted/);
    expect(
      () =>
        new TimeMap([{ start: 0, end: 5 }], [{ start: 0, end: 2, rate: 0 }]),
    ).toThrow(/rate/);
    expect(
      () =>
        new TimeMap(
          [{ start: 0, end: 5 }],
          [
            { start: 2, end: 4, rate: 2 },
            { start: 3, end: 5, rate: 1 },
          ],
        ),
    ).toThrow(/sorted/);
  });
});
