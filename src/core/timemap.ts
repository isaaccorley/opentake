import type { Interval, SpeedSegment } from './project';

type Piece = {
  sourceStart: number;
  sourceEnd: number;
  outputStart: number;
  outputEnd: number;
  rate: number;
};

function assertOrderedIntervals(intervals: Interval[], label: string): void {
  intervals.forEach((interval, index) => {
    if (
      !Number.isFinite(interval.start) ||
      !Number.isFinite(interval.end) ||
      interval.start < 0 ||
      interval.end <= interval.start
    ) {
      throw new RangeError(
        `${label} must contain finite, positive-length source ranges`,
      );
    }
    const previous = intervals[index - 1];
    if (previous !== undefined && interval.start < previous.end) {
      throw new RangeError(`${label} must be sorted and non-overlapping`);
    }
  });
}

export class TimeMap {
  readonly duration: number;
  private readonly pieces: Piece[];

  constructor(trims: Interval[], speeds: SpeedSegment[]) {
    assertOrderedIntervals(trims, 'trims');
    assertOrderedIntervals(speeds, 'speeds');
    if (
      speeds.some(
        (segment) => !Number.isFinite(segment.rate) || segment.rate <= 0,
      )
    ) {
      throw new RangeError('speed rates must be finite and greater than zero');
    }
    this.pieces = [];
    let output = 0;
    for (const trim of trims) {
      let cursor = trim.start;
      const cuts = speeds.filter(
        (s) => s.end > trim.start && s.start < trim.end,
      );
      for (const speed of cuts) {
        const start = Math.max(cursor, speed.start, trim.start);
        const end = Math.min(trim.end, speed.end);
        if (end <= start) continue;
        if (start > cursor) output = this.add(cursor, start, 1, output);
        output = this.add(start, end, speed.rate, output);
        cursor = end;
      }
      if (cursor < trim.end) output = this.add(cursor, trim.end, 1, output);
    }
    this.duration = output;
  }

  private add(
    start: number,
    end: number,
    rate: number,
    output: number,
  ): number {
    const length = (end - start) / rate;
    this.pieces.push({
      sourceStart: start,
      sourceEnd: end,
      outputStart: output,
      outputEnd: output + length,
      rate,
    });
    return output + length;
  }

  toOutput(sourceTime: number): number {
    if (!Number.isFinite(sourceTime))
      throw new RangeError('source time must be finite');
    const p =
      this.pieces.find(
        (piece) =>
          sourceTime >= piece.sourceStart && sourceTime < piece.sourceEnd,
      ) ?? this.pieces.find((piece) => sourceTime === piece.sourceEnd);
    if (!p) throw new RangeError('source time is outside kept trim ranges');
    return p.outputStart + (sourceTime - p.sourceStart) / p.rate;
  }

  toSource(outputTime: number): number {
    if (
      !Number.isFinite(outputTime) ||
      outputTime < 0 ||
      outputTime > this.duration
    )
      throw new RangeError('output time is outside the timeline');
    const p =
      this.pieces.find(
        (piece) =>
          outputTime >= piece.outputStart && outputTime < piece.outputEnd,
      ) ?? (outputTime === this.duration ? this.pieces.at(-1) : undefined);
    if (!p) throw new RangeError('output time is outside the timeline');
    return p.sourceStart + (outputTime - p.outputStart) * p.rate;
  }
}

export function createTimeMap(
  trims: Interval[],
  speeds: SpeedSegment[],
): TimeMap {
  return new TimeMap(trims, speeds);
}
