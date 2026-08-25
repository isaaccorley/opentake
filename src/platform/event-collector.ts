import type { SerializedEventLog } from './protocol';

export type EventCollector = {
  stop: () => SerializedEventLog;
  snapshot: () => SerializedEventLog;
};

export type CollectorClock = {
  epochMs: number;
  nowMs?: () => number;
  timeOriginMs?: number;
};

export function sourceTimeSec(
  epochMs: number,
  eventTimeStamp: number,
  timeOriginMs: number,
): number {
  const absolute =
    eventTimeStamp > 1_000_000_000_000
      ? eventTimeStamp
      : timeOriginMs + eventTimeStamp;
  return Math.max(0, (absolute - epochMs) / 1000);
}

function normalized(value: number, extent: number): number {
  return Math.max(0, Math.min(1, value / Math.max(1, extent)));
}

export function installEventCollector(
  clock: CollectorClock = { epochMs: Date.now() },
): EventCollector {
  const timeOriginMs = clock.timeOriginMs ?? performance.timeOrigin;
  const now = clock.nowMs ?? (() => performance.timeOrigin + performance.now());
  const relativeNow = () => Math.max(0, (now() - clock.epochMs) / 1000);
  const log: SerializedEventLog = {
    epochMs: clock.epochMs,
    cursor: [],
    clicks: [],
    keyMarks: [],
    scroll: [],
    viewport: [],
    blurIntervals: [],
    syncMarkers: [relativeNow()],
  };
  let raf = 0;
  let pending: PointerEvent | undefined;
  let blurStart: number | undefined;

  const sample = () => {
    raf = 0;
    if (!pending) return;
    const event = pending;
    pending = undefined;
    const events =
      typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : [event];
    const width = Math.max(1, document.documentElement.clientWidth);
    const height = Math.max(1, document.documentElement.clientHeight);
    for (const item of events) {
      log.cursor.push(
        sourceTimeSec(clock.epochMs, item.timeStamp, timeOriginMs),
        normalized(item.clientX, width),
        normalized(item.clientY, height),
      );
    }
  };
  const flush = () => {
    if (raf) cancelAnimationFrame(raf);
    sample();
  };
  const pointerMove = (event: PointerEvent) => {
    pending = event;
    if (!raf) raf = requestAnimationFrame(sample);
  };
  const pointerDown = (event: PointerEvent) => {
    log.clicks.push({
      t: sourceTimeSec(clock.epochMs, event.timeStamp, timeOriginMs),
      x: normalized(event.clientX, innerWidth),
      y: normalized(event.clientY, innerHeight),
      button: event.button,
    });
  };
  const pointerUp = () => flush();
  const key = (event: KeyboardEvent) => {
    log.keyMarks.push(
      sourceTimeSec(clock.epochMs, event.timeStamp, timeOriginMs),
    );
  };
  const viewport = () => {
    log.viewport.push({ t: relativeNow(), w: innerWidth, h: innerHeight });
  };
  const scroll = () => {
    log.scroll.push({ t: relativeNow(), x: scrollX, y: scrollY });
  };
  const blur = () => {
    if (blurStart === undefined) blurStart = relativeNow();
  };
  const focus = () => {
    if (blurStart === undefined) return;
    log.blurIntervals.push({ start: blurStart, end: relativeNow() });
    blurStart = undefined;
  };

  addEventListener('pointermove', pointerMove);
  addEventListener('pointerdown', pointerDown);
  addEventListener('pointerup', pointerUp);
  addEventListener('keydown', key);
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', viewport);
  addEventListener('blur', blur);
  addEventListener('focus', focus);
  viewport();
  scroll();

  const stop = () => {
    flush();
    focus();
    removeEventListener('pointermove', pointerMove);
    removeEventListener('pointerdown', pointerDown);
    removeEventListener('pointerup', pointerUp);
    removeEventListener('keydown', key);
    removeEventListener('scroll', scroll);
    removeEventListener('resize', viewport);
    removeEventListener('blur', blur);
    removeEventListener('focus', focus);
    return log;
  };

  return { stop, snapshot: () => structuredClone(log) };
}
