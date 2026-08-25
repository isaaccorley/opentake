import { type EventCollector, installEventCollector } from './event-collector';
import { isRuntimeMessage } from './protocol';

type CollectorGlobal = typeof globalThis & {
  __openTakeCollectorListener?: true;
  __openTakeCollector?: EventCollector;
};

const collectorGlobal = globalThis as CollectorGlobal;

if (!collectorGlobal.__openTakeCollectorListener) {
  collectorGlobal.__openTakeCollectorListener = true;
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      if (!isRuntimeMessage(message)) return false;
      if (message.type === 'COLLECTOR_START') {
        collectorGlobal.__openTakeCollector?.stop();
        collectorGlobal.__openTakeCollector = installEventCollector({
          epochMs: message.epochMs,
        });
        sendResponse({ ok: true });
      }
      if (message.type === 'COLLECTOR_STOP') {
        const log = collectorGlobal.__openTakeCollector?.stop();
        delete collectorGlobal.__openTakeCollector;
        sendResponse({ log });
      }
      return false;
    },
  );
}
