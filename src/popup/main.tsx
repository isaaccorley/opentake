import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recordingStatus, startRecording, stopRecording } from '../platform';
import '../styles.css';
import './styles.css';

type Phase = 'loading' | 'idle' | 'starting' | 'recording' | 'stopping';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'extension unavailable';
}

function Popup() {
  const recordingUnavailable = import.meta.env.MODE === 'firefox';
  const [status, setStatus] = useState('Checking the active tab…');
  const [phase, setPhase] = useState<Phase>('loading');
  const [targetTabId, setTargetTabId] = useState<number>();
  const cancelRequested = useRef(false);
  const cancelCompleted = useRef(false);

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      recordingStatus(),
    ])
      .then(([tabs, current]) => {
        setTargetTabId(tabs[0]?.id);
        if (current.ok && current.state !== 'idle') {
          setPhase(current.state === 'starting' ? 'starting' : 'recording');
          setStatus(
            current.state === 'starting'
              ? 'Recording countdown in progress.'
              : 'Recording this tab to local storage.',
          );
        } else {
          setPhase('idle');
          setStatus(
            recordingUnavailable
              ? 'Firefox editor available. Tab recording is not ready yet.'
              : 'Ready to record the active tab.',
          );
        }
      })
      .catch((error: unknown) => {
        setPhase('idle');
        setStatus(`Could not inspect this tab: ${errorMessage(error)}`);
      });
  }, []);

  useEffect(() => {
    if (phase !== 'starting') return;
    const interval = window.setInterval(() => {
      void recordingStatus().then((current) => {
        if (current.ok && current.state === 'recording') {
          setPhase('recording');
          setStatus('Recording this tab to local storage.');
        }
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [phase]);

  const start = () => {
    if (targetTabId === undefined) {
      setStatus('This tab cannot be captured.');
      return;
    }

    // This call must stay synchronous with the click. Stream IDs are user-gesture bound.
    const streamIdPromise =
      import.meta.env.MODE === 'e2e'
        ? Promise.resolve('__opentake_e2e_synthetic_media__')
        : import.meta.env.MODE === 'firefox'
          ? Promise.reject(
              new Error('Firefox tab capture is not implemented yet.'),
            )
          : chrome.tabCapture.getMediaStreamId({ targetTabId });
    cancelRequested.current = false;
    cancelCompleted.current = false;
    setPhase('starting');
    setStatus('Starting a 3 second countdown…');
    void streamIdPromise
      .then((streamId) => startRecording(targetTabId, streamId, 3000))
      .then(async (response) => {
        if (!response.ok) throw new Error(response.error);
        if (cancelRequested.current && !cancelCompleted.current) {
          const stopped = await stopRecording();
          if (!stopped.ok) throw new Error(stopped.error);
          setPhase('idle');
          setStatus('Recording countdown canceled.');
          return;
        }
        window.setTimeout(() => {
          void recordingStatus().then((current) => {
            if (current.ok && current.state === 'recording') {
              setPhase('recording');
              setStatus('Recording this tab to local storage.');
            } else if (current.ok && current.state === 'idle') {
              setPhase('idle');
              void chrome.storage.local.get('recordingError').then((stored) => {
                const recordingError = stored.recordingError;
                setStatus(
                  typeof recordingError === 'string'
                    ? `Could not start: ${recordingError}`
                    : 'Recording could not start.',
                );
              });
            }
          });
        }, 3200);
      })
      .catch((error: unknown) => {
        setPhase('idle');
        setStatus(`Could not start: ${errorMessage(error)}`);
      });
  };

  const stop = () => {
    if (phase === 'starting') {
      cancelRequested.current = true;
      setPhase('stopping');
      setStatus('Canceling recording countdown…');
      void stopRecording().then((response) => {
        if (response.ok) {
          cancelCompleted.current = true;
          setPhase('idle');
          setStatus('Recording countdown canceled.');
        } else if (response.code !== 'NO_SESSION') {
          setPhase('starting');
          setStatus(`Could not cancel: ${response.error}`);
        }
      });
      return;
    }
    setPhase('stopping');
    setStatus('Finalizing local media…');
    void stopRecording()
      .then((response) => {
        if (!response.ok) throw new Error(response.error);
        setPhase('idle');
        setStatus(
          'Recording stopped. The editor will open after finalization.',
        );
      })
      .catch((error: unknown) => {
        setPhase('recording');
        setStatus(`Could not stop: ${errorMessage(error)}`);
      });
  };

  const isActive = phase === 'starting' || phase === 'recording';
  const isBusy = phase === 'loading' || phase === 'stopping';

  return (
    <main className="popup">
      <div className="popup-head">
        <span className="brand-mark">OT</span>
        <div>
          <h1>OpenTake</h1>
          <small>local tab recorder</small>
        </div>
        <span
          role="img"
          className={`record-dot ${isActive ? 'live' : ''}`}
          aria-label={isActive ? 'Recording' : 'Idle'}
        />
      </div>
      <div className="popup-rule" />
      <p className="popup-status" aria-live="polite">
        {status}
      </p>
      <button
        type="button"
        className="record-button"
        onClick={isActive ? stop : start}
        disabled={isBusy || recordingUnavailable}
      >
        <span className="record-circle" />
        {phase === 'recording'
          ? 'Stop recording'
          : phase === 'starting'
            ? 'Cancel countdown'
            : phase === 'stopping'
              ? 'Finalizing…'
              : 'Record this tab'}
      </button>
      <p className="popup-note">
        Video stays on this device. No page text, URLs, or key values are saved.
      </p>
      <button
        type="button"
        className="open-editor"
        onClick={() => {
          void chrome.tabs.create({
            url: chrome.runtime.getURL('editor.html'),
          });
        }}
      >
        Open editor <span>↗</span>
      </button>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Popup root element is missing');
createRoot(root).render(<Popup />);
