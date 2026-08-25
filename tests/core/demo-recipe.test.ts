import { describe, expect, it } from 'vitest';
import { DemoRecipeSchema } from '../../src/core/demo-recipe';
import { fmowDemoRecipe } from '../fixtures/fmow-demo';

describe('DemoRecipe', () => {
  it('captures the FMoW 2K WebM acceptance workflow', () => {
    const recipe = DemoRecipeSchema.parse(fmowDemoRecipe);
    expect(recipe.export).toEqual({
      width: 2560,
      height: 1440,
      playbackRate: 1.5,
      container: 'webm',
      codec: 'vp9',
      quality: 80,
    });
    expect(recipe.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'clickRole', name: 'Zoom in' }),
        expect.objectContaining({ type: 'pointerClick' }),
      ]),
    );
  });

  it('rejects scriptable actions and non-web targets', () => {
    expect(
      DemoRecipeSchema.safeParse({
        ...fmowDemoRecipe,
        targetUrl: 'file:///private/demo.html',
        actions: [{ type: 'evaluate', source: 'fetch(secret)' }],
      }).success,
    ).toBe(false);
  });
});
