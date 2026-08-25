import { z } from 'zod';

const clickRole = z.object({
  type: z.literal('clickRole'),
  role: z.enum(['button', 'link']),
  name: z.string().min(1),
  repeat: z.number().int().min(1).max(20).default(1),
});
const pointerClick = z.object({
  type: z.literal('pointerClick'),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
const keyPress = z.object({
  type: z.literal('keyPress'),
  key: z.enum([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'b',
    'Escape',
  ]),
});
const waitForText = z.object({
  type: z.literal('waitForText'),
  text: z.string().min(1),
  timeoutMs: z.number().int().min(100).max(60_000).default(15_000),
});
const pause = z.object({
  type: z.literal('pause'),
  durationMs: z.number().int().min(0).max(10_000),
});

export const DemoRecipeSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  targetUrl: z.url().refine((url) => /^https?:/.test(url), {
    message: 'targetUrl must use HTTP or HTTPS',
  }),
  viewport: z.object({
    width: z.number().int().min(640).max(3840),
    height: z.number().int().min(480).max(2160),
  }),
  actions: z
    .array(
      z.discriminatedUnion('type', [
        clickRole,
        pointerClick,
        keyPress,
        waitForText,
        pause,
      ]),
    )
    .min(1),
  export: z.object({
    width: z.number().int().min(640).max(3840),
    height: z.number().int().min(480).max(2160),
    playbackRate: z.number().min(0.25).max(4),
    container: z.literal('webm'),
    codec: z.enum(['vp9', 'av1']),
    quality: z.number().int().min(1).max(100),
  }),
});

export type DemoRecipe = z.infer<typeof DemoRecipeSchema>;
