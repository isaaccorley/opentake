import { describe, expect, it } from 'vitest';
import { sourceTimeSec } from '../../src/platform/event-collector';

describe('event clock alignment', () => {
  it('aligns context-relative event timestamps to the recording epoch', () => {
    const timeOriginMs = 1_800_000_000_000;
    const epochMs = timeOriginMs + 5_000;
    expect(sourceTimeSec(epochMs, 5_000, timeOriginMs)).toBe(0);
    expect(sourceTimeSec(epochMs, 5_199, timeOriginMs)).toBeCloseTo(0.199);
    expect(sourceTimeSec(epochMs, epochMs + 100, timeOriginMs)).toBeCloseTo(
      0.1,
    );
  });
});
