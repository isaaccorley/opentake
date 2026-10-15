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
  const startPending = useRef(false);
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
    if (phase !== 'starting' && phase !== 'recording') return;
    const interval = window.setInterval(() => {
      void recordingStatus()
        .then(async (current) => {
          if (current.ok && current.state === 'recording') {
            setPhase('recording');
            setStatus('Recording this tab to local storage.');
          } else if (
            phase === 'starting' &&
            current.ok &&
            current.state === 'idle' &&
            !startPending.current
          ) {
            const stored = await chrome.storage.local.get('recordingError');
            setPhase('idle');
            setStatus(
              typeof stored.recordingError === 'string'
                ? `Could not start: ${stored.recordingError}`
                : 'Recording could not start.',
            );
          } else if (
            phase === 'recording' &&
            current.ok &&
            current.state === 'idle'
          ) {
            setPhase('idle');
            setStatus(
              'Recording finished. Open the editor to view your video.',
            );
          }
        })
        .catch((error: unknown) =>
          setStatus(`Could not check recording: ${errorMessage(error)}`),
        );
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase]);

  const start = async () => {
    if (targetTabId === undefined) {
      setStatus('This tab cannot be captured.');
      return;
    }
    startPending.current = true;
    cancelRequested.current = false;
    cancelCompleted.current = false;
    setPhase('starting');
    setStatus('Starting a 3 second countdown…');
    try {
      const response = await startRecording(
        targetTabId,
        import.meta.env.MODE === 'e2e'
          ? '__opentake_e2e_synthetic_media__'
          : undefined,
        3000,
      );
      if (!response.ok) throw new Error(response.error);
      // Cancellation can arrive while the worker is creating the offscreen document.
      if (cancelRequested.current && !cancelCompleted.current) {
        if (response.state !== 'stopped') {
          const stopped = await stopRecording();
          if (!stopped.ok) throw new Error(stopped.error);
        }
        setPhase('idle');
        setStatus('Recording countdown canceled.');
      }
    } catch (error) {
      setPhase('idle');
      setStatus(`Could not start: ${errorMessage(error)}`);
    } finally {
      startPending.current = false;
    }
  };

  const stop = async () => {
    const canceling = phase === 'starting';
    if (canceling) cancelRequested.current = true;
    setPhase('stopping');
    setStatus(
      canceling ? 'Canceling recording countdown…' : 'Finalizing local media…',
    );
    try {
      const response = await stopRecording();
      // The pending start call handles cancellation if no session exists yet.
      if (!response.ok && canceling && response.code === 'NO_SESSION') return;
      if (!response.ok) throw new Error(response.error);
      if (canceling) cancelCompleted.current = true;
      setPhase('idle');
      setStatus(
        canceling
          ? 'Recording countdown canceled.'
          : 'Recording stopped. The editor will open after finalization.',
      );
    } catch (error) {
      setPhase(canceling ? 'starting' : 'recording');
      setStatus(`Could not stop: ${errorMessage(error)}`);
    }
  };

  const isActive = phase === 'starting' || phase === 'recording';
  const isBusy = phase === 'loading' || phase === 'stopping';

  return (
    <main className="popup">
      <div className="popup-head">
        <span className="brand-mark">OT</span>
        <div>
          <h1>OpenTake</h1>
          <small>local video studio</small>
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
        Video stays on this device. Tab audio included; microphone off. No page
        text, URLs, or key values are collected as metadata.
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
