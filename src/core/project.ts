import { z } from 'zod';

const finiteNumber = z.number().finite();
const nonNegative = finiteNumber.nonnegative();

export type Interval = { start: number; end: number };
export type SpeedSegment = { start: number; end: number; rate: number };
export type ZoomKeyframe = {
  t: number;
  scale: number;
  mode: 'follow-cursor' | 'fixed';
  center?: { x: number; y: number };
  easing: 'ease-in-out' | 'linear';
};
export type Background =
  | { kind: 'none' }
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'page-sampled' }
  | { kind: 'image'; mediaKey: string };

export type EventLog = {
  epochMs: number;
  cursor: Float32Array;
  clicks: { t: number; x: number; y: number; button: number }[];
  keyMarks: number[];
  scroll: { t: number; x: number; y: number }[];
  viewport: { t: number; w: number; h: number }[];
  blurIntervals: Interval[];
};

export type ExportSettings = {
  aspect: '16:9' | '9:16' | '1:1' | 'source';
  resolution: 720 | 1080 | 1440 | 2160;
  fps: 30 | 60;
  container: 'mp4' | 'webm';
  videoCodec: 'h264' | 'vp9' | 'av1';
  audioCodec: 'aac' | 'opus';
  rateControl:
    | { mode: 'quality'; quality: number }
    | { mode: 'bitrate'; bitrateMbps: number };
};

export type ProjectDoc = {
  version: 1;
  id: string;
  createdAt: number;
  source: {
    mediaKey: string;
    durationSec: number;
    width: number;
    height: number;
    fps: number;
    devicePixelRatio: number;
    hasAudio: boolean;
  };
  events: EventLog;
  edit: { trims: Interval[]; speed: SpeedSegment[]; zooms: ZoomKeyframe[] };
  look: {
    background: Background;
    padding: number;
    cornerRadius: number;
    shadow: {
      color: string;
      blur: number;
      offsetX: number;
      offsetY: number;
    } | null;
    cursor: { scale: number; smoothing: number; clickRipple: boolean };
  };
  export: ExportSettings;
};

const intervalSchema = z
  .object({ start: nonNegative, end: nonNegative })
  .superRefine((v, c) => {
    if (v.end <= v.start)
      c.addIssue({ code: 'custom', message: 'end must be greater than start' });
  });
const speedSchema = intervalSchema.extend({ rate: finiteNumber.positive() });
const pointSchema = z.object({
  x: finiteNumber.min(0).max(1),
  y: finiteNumber.min(0).max(1),
});
const zoomSchema = z
  .object({
    t: nonNegative,
    scale: finiteNumber.min(1),
    mode: z.enum(['follow-cursor', 'fixed']),
    center: pointSchema.optional(),
    easing: z.enum(['ease-in-out', 'linear']),
  })
  .superRefine((v, c) => {
    if (v.mode === 'fixed' && !v.center)
      c.addIssue({
        code: 'custom',
        path: ['center'],
        message: 'fixed zoom needs a center',
      });
    if (v.mode === 'follow-cursor' && v.center)
      c.addIssue({
        code: 'custom',
        path: ['center'],
        message: 'follow-cursor cannot have a center',
      });
  });

const eventLogSchema = z.object({
  epochMs: finiteNumber,
  cursor: z
    .instanceof(Float32Array)
    .refine((v) => v.length % 3 === 0, 'cursor must contain [t,x,y] triples'),
  clicks: z.array(
    z.object({
      t: nonNegative,
      x: pointSchema.shape.x,
      y: pointSchema.shape.y,
      button: finiteNumber.int().nonnegative(),
    }),
  ),
  keyMarks: z.array(nonNegative),
  scroll: z.array(
    z.object({ t: nonNegative, x: finiteNumber, y: finiteNumber }),
  ),
  viewport: z.array(
    z.object({
      t: nonNegative,
      w: finiteNumber.positive(),
      h: finiteNumber.positive(),
    }),
  ),
  blurIntervals: z.array(intervalSchema),
});

const exportSchema = z
  .object({
    aspect: z.enum(['16:9', '9:16', '1:1', 'source']),
    resolution: z.union([
      z.literal(720),
      z.literal(1080),
      z.literal(1440),
      z.literal(2160),
    ]),
    fps: z.union([z.literal(30), z.literal(60)]),
    container: z.enum(['mp4', 'webm']),
    videoCodec: z.enum(['h264', 'vp9', 'av1']),
    audioCodec: z.enum(['aac', 'opus']),
    rateControl: z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('quality'),
        quality: finiteNumber.int().min(1).max(100),
      }),
      z.object({
        mode: z.literal('bitrate'),
        bitrateMbps: finiteNumber.positive().max(200),
      }),
    ]),
  })
  .superRefine((v, c) => {
    const valid =
      v.container === 'mp4'
        ? v.videoCodec === 'h264' && v.audioCodec === 'aac'
        : (v.videoCodec === 'vp9' || v.videoCodec === 'av1') &&
          v.audioCodec === 'opus';
    if (!valid)
      c.addIssue({
        code: 'custom',
        path: ['container'],
        message: 'container and codecs are incompatible',
      });
  });

export const ProjectDocSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    createdAt: finiteNumber,
    source: z.object({
      mediaKey: z.string().min(1),
      durationSec: finiteNumber.positive(),
      width: finiteNumber.int().positive(),
      height: finiteNumber.int().positive(),
      fps: finiteNumber.positive(),
      devicePixelRatio: finiteNumber.positive(),
      hasAudio: z.boolean(),
    }),
    events: eventLogSchema,
    edit: z.object({
      trims: z.array(intervalSchema),
      speed: z.array(speedSchema),
      zooms: z.array(zoomSchema),
    }),
    look: z.object({
      background: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('none') }),
        z.object({ kind: z.literal('solid'), color: z.string().min(1) }),
        z.object({
          kind: z.literal('gradient'),
          from: z.string().min(1),
          to: z.string().min(1),
          angle: finiteNumber,
        }),
        z.object({ kind: z.literal('page-sampled') }),
        z.object({ kind: z.literal('image'), mediaKey: z.string().min(1) }),
      ]),
      padding: finiteNumber.min(0).max(0.25),
      cornerRadius: nonNegative,
      shadow: z
        .object({
          color: z.string().min(1),
          blur: nonNegative,
          offsetX: finiteNumber,
          offsetY: finiteNumber,
        })
        .nullable(),
      cursor: z.object({
        scale: finiteNumber.positive(),
        smoothing: finiteNumber.min(0).max(1),
        clickRipple: z.boolean(),
      }),
    }),
    export: exportSchema,
  })
  .superRefine((doc, c) => {
    const sorted = (xs: { start: number; end: number }[]) =>
      xs.every((x, i) => i === 0 || x.start >= xs[i - 1]!.end);
    const chronological = (times: number[]) =>
      times.every((time, index) => index === 0 || time >= times[index - 1]!);
    const inSource = (time: number) => time <= doc.source.durationSec;
    if (!sorted(doc.edit.trims))
      c.addIssue({
        code: 'custom',
        path: ['edit', 'trims'],
        message: 'trims must be sorted and non-overlapping',
      });
    if (!sorted(doc.edit.speed))
      c.addIssue({
        code: 'custom',
        path: ['edit', 'speed'],
        message: 'speed segments must be sorted and non-overlapping',
      });
    if (!chronological(doc.edit.zooms.map((zoom) => zoom.t)))
      c.addIssue({
        code: 'custom',
        path: ['edit', 'zooms'],
        message: 'zooms must be chronological',
      });
    for (const range of doc.edit.trims)
      if (range.end > doc.source.durationSec)
        c.addIssue({
          code: 'custom',
          path: ['edit', 'trims'],
          message: 'trim exceeds source duration',
        });
    for (const segment of doc.edit.speed)
      if (segment.end > doc.source.durationSec)
        c.addIssue({
          code: 'custom',
          path: ['edit', 'speed'],
          message: 'speed segment exceeds source duration',
        });
    for (const zoom of doc.edit.zooms)
      if (zoom.t > doc.source.durationSec)
        c.addIssue({
          code: 'custom',
          path: ['edit', 'zooms'],
          message: 'zoom exceeds source duration',
        });
    const cursorTimes: number[] = [];
    for (let index = 0; index < doc.events.cursor.length; index += 3) {
      const time = doc.events.cursor[index]!;
      const x = doc.events.cursor[index + 1]!;
      const y = doc.events.cursor[index + 2]!;
      cursorTimes.push(time);
      if (!Number.isFinite(time) || time < 0 || !inSource(time))
        c.addIssue({
          code: 'custom',
          path: ['events', 'cursor', index],
          message: 'cursor time is outside source duration',
        });
      if (
        !Number.isFinite(x) ||
        x < 0 ||
        x > 1 ||
        !Number.isFinite(y) ||
        y < 0 ||
        y > 1
      )
        c.addIssue({
          code: 'custom',
          path: ['events', 'cursor', index],
          message: 'cursor coordinates must be normalized',
        });
    }
    if (!chronological(cursorTimes))
      c.addIssue({
        code: 'custom',
        path: ['events', 'cursor'],
        message: 'cursor events must be chronological',
      });
    const eventGroups: Array<[string, number[]]> = [
      ['clicks', doc.events.clicks.map((event) => event.t)],
      ['keyMarks', doc.events.keyMarks],
      ['scroll', doc.events.scroll.map((event) => event.t)],
      ['viewport', doc.events.viewport.map((event) => event.t)],
    ];
    for (const [name, times] of eventGroups) {
      if (!chronological(times))
        c.addIssue({
          code: 'custom',
          path: ['events', name],
          message: `${name} must be chronological`,
        });
      if (times.some((time) => !inSource(time)))
        c.addIssue({
          code: 'custom',
          path: ['events', name],
          message: `${name} exceeds source duration`,
        });
    }
    if (!sorted(doc.events.blurIntervals))
      c.addIssue({
        code: 'custom',
        path: ['events', 'blurIntervals'],
        message: 'blur intervals must be sorted and non-overlapping',
      });
    if (doc.events.blurIntervals.some((interval) => !inSource(interval.end)))
      c.addIssue({
        code: 'custom',
        path: ['events', 'blurIntervals'],
        message: 'blur interval exceeds source duration',
      });
  });
export const EventLogSchema = eventLogSchema;
export const projectDocSchema = ProjectDocSchema;

export function validateProjectDoc(value: unknown): ProjectDoc {
  return ProjectDocSchema.parse(value) as ProjectDoc;
}

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
function toJson(value: unknown): JsonValue {
  if (value instanceof Float32Array)
    return { $type: 'Float32Array', values: Array.from(value) };
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toJson(v)]),
    );
  return value as JsonValue;
}
function fromJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fromJson);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.$type === 'Float32Array' && Array.isArray(obj.values))
      return new Float32Array(obj.values as number[]);
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, fromJson(v)]),
    );
  }
  return value;
}
export function serializeProjectDoc(doc: ProjectDoc): string {
  return JSON.stringify(toJson(validateProjectDoc(doc)));
}
export function deserializeProjectDoc(serialized: string): ProjectDoc {
  return validateProjectDoc(fromJson(JSON.parse(serialized)));
}
