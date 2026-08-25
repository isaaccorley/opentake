import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recordingStatus, startRecording, stopRecording } from '../platform';
import '../styles.css';
import './styles.css';

type Phase = 'loading' | 'idle' | 'starting' | 'recording' | 'stopping';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'extension unavailable';
}

function Popup() {
  const [status, setStatus] = useState('Checking the active tab…');
  const [phase, setPhase] = useState<Phase>('loading');
  const [targetTabId, setTargetTabId] = useState<number>();

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
          setStatus('Ready to record the active tab.');
        }
      })
      .catch((error: unknown) => {
        setPhase('idle');
        setStatus(`Could not inspect this tab: ${errorMessage(error)}`);
      });
  }, []);

  const start = () => {
    if (targetTabId === undefined) {
      setStatus('This tab cannot be captured.');
      return;
    }

    // This call must stay synchronous with the click. Stream IDs are user-gesture bound.
    const streamIdPromise = chrome.tabCapture.getMediaStreamId({ targetTabId });
    setPhase('starting');
    setStatus('Starting a 3 second countdown…');
    void streamIdPromise
      .then((streamId) => startRecording(targetTabId, streamId, 3000))
      .then((response) => {
        if (!response.ok) throw new Error(response.error);
        window.setTimeout(() => {
          void recordingStatus().then((current) => {
            if (current.ok && current.state === 'recording') {
              setPhase('recording');
              setStatus('Recording this tab to local storage.');
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
          <strong>OpenTake</strong>
          <small>local tab recorder</small>
        </div>
        <span
          className={`record-dot ${isActive ? 'live' : ''}`}
          aria-label={isActive ? 'Recording' : 'Idle'}
        />
      </div>
      <div className="popup-rule" />
      <p className="popup-status" aria-live="polite">
        {status}
      </p>
      <button
        className="record-button"
        onClick={isActive ? stop : start}
        disabled={isBusy}
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

createRoot(document.getElementById('root')!).render(<Popup />);
