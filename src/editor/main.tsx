import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  type ExportCodec,
  probeExportCapabilities,
} from '../platform/export-capabilities';
import { useProjectStore } from './store';
import '../styles.css';
import './styles.css';

const placeholderDuration = 92.4;
const ticks = Array.from({ length: 12 }, (_, i) => i);
const waveform = Array.from({ length: 160 }, (_, index) => ({
  id: `wave-${index}`,
  height: 8 + ((index * 17) % 23) + Math.abs(Math.sin(index / 5) * 13),
}));
function tc(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  const f = Math.floor((seconds % 1) * 30)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}:${f}`;
}

function App() {
  const { doc, past, future, undo, redo, updateDoc } = useProjectStore();
  const [time, setTime] = useState(18.7);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<'Trim' | 'Zoom' | 'Speed' | 'Export'>(
    'Trim',
  );
  const duration = doc?.source.durationSec ?? placeholderDuration;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => setTime((t) => (t >= duration ? 0 : t + 1 / 30)),
      33,
    );
    return () => window.clearInterval(id);
  }, [duration, playing]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((p) => !p);
      }
      if (event.key === 'ArrowLeft') setTime((t) => Math.max(0, t - 1 / 30));
      if (event.key === 'ArrowRight')
        setTime((t) => Math.min(duration, t + 1 / 30));
      if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'k')
        setPlaying(false);
      if (event.key.toLowerCase() === 'l') setPlaying(true);
      if (event.key === '[') setTime((t) => Math.max(0, t - 1));
      if (event.key === ']') setTime((t) => Math.min(duration, t + 1));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration, redo, undo]);
  const playhead = `${(time / duration) * 100}%`;
  const sourceLabel = doc
    ? `${doc.source.width} × ${doc.source.height}`
    : 'No project loaded';
  const updateTrim = () => {
    if (!doc) return;
    updateDoc((current) => ({
      ...current,
      edit: { ...current.edit, trims: [{ start: 0, end: duration }] },
    }));
  };
  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">OT</span>
          <span>OpenTake</span>
          <span className="crumb">/ Editor</span>
        </div>
        <div className="transport">
          <button
            type="button"
            className="icon-button"
            onClick={undo}
            disabled={!past.length}
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={redo}
            disabled={!future.length}
            aria-label="Redo"
          >
            ↷
          </button>
          <button
            type="button"
            className={`play-button ${playing ? 'is-playing' : ''}`}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? 'Ⅱ' : '▶'}
          </button>
          <output className="timecode" aria-label="Current time">
            {tc(time)} <span>/ {tc(duration)}</span>
          </output>
        </div>
        <div className="top-actions">
          <span className="source-meta">{sourceLabel} · 30 fps</span>
          <button
            type="button"
            className="export-top"
            onClick={() => setPanel('Export')}
          >
            Export
          </button>
        </div>
      </header>
      <section className="workbench">
        <div className="preview-wrap">
          <div className="preview-toolbar">
            <span>Preview</span>
            <span className="preview-meta">{tc(time)} · 100%</span>
          </div>
          <div
            className="canvas-stage"
            role="img"
            aria-label="Video preview placeholder"
          >
            <div className="canvas-frame">
              <div className="fake-window">
                <span className="fake-dot red" />
                <span className="fake-dot yellow" />
                <span className="fake-dot green" />
                <span className="fake-url">opentake.local / recorded tab</span>
              </div>
              <div className="fake-content">
                <div className="fake-title" />
                <div className="fake-line wide" />
                <div className="fake-line" />
                <div className="fake-block" />
                <div className="cursor" />
              </div>
            </div>
          </div>
          <div className="zoom-indicator">
            100% <span>·</span>{' '}
            {doc ? 'cursor tracking active' : 'sample preview'}
          </div>
        </div>
        <aside className="inspector" aria-label="Edit controls">
          <div className="inspector-tabs">
            {(['Trim', 'Zoom', 'Speed', 'Export'] as const).map((name) => (
              <button
                type="button"
                key={name}
                className={panel === name ? 'active' : ''}
                onClick={() => setPanel(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {panel === 'Trim' && (
            <div className="inspector-body">
              <p className="eyebrow">Source range</p>
              <div className="field-grid">
                <label>
                  In
                  <input defaultValue="00:00:00" />
                </label>
                <label>
                  Out
                  <input defaultValue={tc(duration)} />
                </label>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={updateTrim}
              >
                Set range to full source
              </button>
              <p className="hint">
                Trim is non-destructive. Source time stays stable when speed
                changes.
              </p>
            </div>
          )}
          {panel === 'Zoom' && (
            <div className="inspector-body">
              <p className="eyebrow">Camera</p>
              <label className="range-label">
                Scale <output>1.25×</output>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step=".05"
                  defaultValue="1.25"
                />
              </label>
              <label className="range-label">
                Smoothing <output>0.60</output>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  defaultValue=".6"
                />
              </label>
              <p className="hint">
                Follow-cursor keyframes are shown in the zoom lane below.
              </p>
            </div>
          )}
          {panel === 'Speed' && (
            <div className="inspector-body">
              <p className="eyebrow">Rate at playhead</p>
              <div className="rate-readout">
                1.00<span>×</span>
              </div>
              <input
                type="range"
                min=".25"
                max="3"
                step=".25"
                defaultValue="1"
              />
              <p className="hint">
                Rate changes apply to source-time ranges and remain editable.
              </p>
            </div>
          )}
          {panel === 'Export' && <ExportPanel />}
        </aside>
      </section>
      <section className="timeline" aria-label="Timeline editor">
        <div className="timeline-head">
          <div>
            <span className="eyebrow">Timeline</span>
            <span className="timeline-name">
              {doc ? doc.id : 'Sample layout'}
            </span>
          </div>
          <div className="timeline-actions">
            <button type="button" onClick={() => setTime(0)}>
              Home
            </button>
            <button type="button" onClick={() => setTime(duration)}>
              End
            </button>
            <span className="snap">⌁ Snap on</span>
          </div>
        </div>
        <div className="ruler">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${(tick / 11) * 100}%` }}>
              {tc((duration / 11) * tick)}
            </span>
          ))}
        </div>
        <div
          className="track-area"
          role="slider"
          tabIndex={0}
          aria-label="Timeline playhead"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={time}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setTime((current) => Math.max(0, current - 1 / 30));
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setTime((current) => Math.min(duration, current + 1 / 30));
            }
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTime(
              Math.max(
                0,
                Math.min(
                  duration,
                  ((e.clientX - rect.left) / rect.width) * duration,
                ),
              ),
            );
          }}
        >
          <div className="track-labels">
            <span>VIDEO</span>
            <span>WAVEFORM</span>
            <span>ZOOM</span>
            <span>SPEED</span>
          </div>
          <div className="tracks">
            <div className="video-track">
              <span className="clip-name">
                {doc ? doc.source.mediaKey : 'sample-recording.webm'}
              </span>
              <span className="clip-range">00:00:00 — {tc(duration)}</span>
            </div>
            <div className="wave-track">
              {waveform.map((bar) => (
                <i key={bar.id} style={{ height: `${bar.height}px` }} />
              ))}
            </div>
            <div className="zoom-track">
              <span className="zoom-ramp" />
              <span className="zoom-ramp small" />
            </div>
            <div className="speed-track">
              <svg
                viewBox="0 0 100 42"
                preserveAspectRatio="none"
                aria-label="Speed curve"
              >
                <path d="M0 30 C18 30 20 30 28 20 S44 8 55 20 S70 37 78 25 S89 12 100 12" />
              </svg>
            </div>
          </div>
          <div className="playhead" style={{ left: playhead }}>
            <span>{tc(time)}</span>
          </div>
        </div>
      </section>
      <footer className="statusbar">
        <span>
          <kbd>Space</kbd> play <kbd>J</kbd>
          <kbd>K</kbd>
          <kbd>L</kbd> shuttle <kbd>←</kbd>
          <kbd>→</kbd> frame step
        </span>
        <span>
          {doc
            ? 'Project ready · local only'
            : 'No project loaded · controls are preview-safe'}
        </span>
      </footer>
    </main>
  );
}

const exportOptions: Record<
  'mp4' | 'webm',
  Array<{ label: string; value: ExportCodec }>
> = {
  mp4: [
    {
      label: 'H.264 / AAC · widest compatibility',
      value: 'h264-mp4',
    },
  ],
  webm: [
    { label: 'VP9 / Opus', value: 'vp9-webm' },
    { label: 'AV1 / Opus · better compression', value: 'av1-webm' },
  ],
};

function ExportPanel() {
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [codec, setCodec] = useState<ExportCodec>('h264-mp4');
  const [rateControl, setRateControl] = useState<'quality' | 'bitrate'>(
    'quality',
  );
  const [capabilities, setCapabilities] = useState<
    Record<ExportCodec, boolean>
  >({ 'h264-mp4': false, 'vp9-webm': false, 'av1-webm': false });
  useEffect(() => {
    void probeExportCapabilities().then((items) =>
      setCapabilities(
        Object.fromEntries(
          items.map((item) => [item.codec, item.supported]),
        ) as Record<ExportCodec, boolean>,
      ),
    );
  }, []);
  const options = exportOptions[format];
  const selectedSupported = capabilities[codec];
  return (
    <div className="inspector-body">
      <p className="eyebrow">Export settings</p>
      <label className="select-label">
        Container
        <select
          value={format}
          onChange={(e) => {
            const next = e.target.value === 'webm' ? 'webm' : 'mp4';
            setFormat(next);
            setCodec(next === 'mp4' ? 'h264-mp4' : 'vp9-webm');
          }}
        >
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </select>
      </label>
      <label className="select-label">
        Codec / audio
        <select
          value={codec}
          onChange={(e) => setCodec(e.target.value as ExportCodec)}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={!capabilities[option.value]}
            >
              {option.label}
              {!capabilities[option.value] ? ' · unavailable' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="select-label">
        Rate control
        <select
          value={rateControl}
          onChange={(event) =>
            setRateControl(
              event.target.value === 'bitrate' ? 'bitrate' : 'quality',
            )
          }
        >
          <option value="quality">Constant quality</option>
          <option value="bitrate">Target bitrate</option>
        </select>
      </label>
      <label className="select-label">
        {rateControl === 'quality' ? 'Quality' : 'Bitrate (Mbps)'}
        <input
          defaultValue={rateControl === 'quality' ? '80' : '12'}
          type="number"
          min="1"
          max={rateControl === 'quality' ? '100' : '200'}
        />
      </label>
      <button type="button" className="export-button" disabled>
        Export renderer not wired yet
      </button>
      <p className="hint">
        {selectedSupported
          ? 'This format is supported on this device. Encoding lands with the render milestone.'
          : 'This codec combination is unavailable on this device.'}
      </p>
    </div>
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Editor root element is missing');
createRoot(root).render(<App />);
