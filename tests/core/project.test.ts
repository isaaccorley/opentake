import { describe, expect, it } from 'vitest';
import {
  deserializeProjectDoc,
  ProjectDocSchema,
  serializeProjectDoc,
} from '../../src/core/project';
import { syntheticProjectDoc as doc } from '../fixtures/project';

describe('ProjectDoc', () => {
  it('round-trips and preserves Float32Array', () => {
    const roundTrip = deserializeProjectDoc(serializeProjectDoc(doc));
    expect(roundTrip).toEqual(doc);
    expect(roundTrip.events.cursor).toBeInstanceOf(Float32Array);
  });
  it('rejects invalid time ordering and codec combinations', () => {
    expect(
      ProjectDocSchema.safeParse({
        ...doc,
        export: { ...doc.export, container: 'webm' },
      }).success,
    ).toBe(false);
    expect(
      ProjectDocSchema.safeParse({
        ...doc,
        edit: {
          ...doc.edit,
          trims: [
            { start: 2, end: 4 },
            { start: 3, end: 5 },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      ProjectDocSchema.safeParse({
        ...doc,
        events: { ...doc.events, cursor: new Float32Array([11, 0.5, 0.5]) },
      }).success,
    ).toBe(false);
  });
});
