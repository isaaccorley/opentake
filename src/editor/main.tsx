import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectDoc } from '../core/project';
import { OpfsStore } from '../platform/opfs';
import { downloadFile, type ExportJob, exportVideo } from './export';
import { Inspector } from './inspector';
import { importVideo, loadLibrary, projectName, saveProject } from './library';
import { useProjectStore } from './store';
import '../styles.css';
import './styles.css';

function timecode(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}
function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function App() {
  const { doc, setDoc, updateDoc, undo, redo } = useProjectStore();
  const [library, setLibrary] = useState<ProjectDoc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [savedDoc, setSavedDoc] = useState<ProjectDoc | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [exported, setExported] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const job = useRef<ExportJob | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const range = doc?.edit.trims[0];
  const start = range?.start ?? 0;
  const end = range?.end ?? 0;
  const locked = busy || progress !== null;

  useEffect(() => {
    void loadLibrary()
      .then((docs) => {
        setLibrary(docs);
        const requested = new URLSearchParams(location.search).get('project');
        const selected = docs.find((item) => item.id === requested);
        if (selected) setDoc(selected);
      })
      .catch((cause: unknown) =>
        setError(`Could not open library: ${message(cause)}`),
      )
      .finally(() => setBusy(false));
  }, [setDoc]);

  useEffect(() => {
    if (!doc) return;
    setSaveFailed(false);
    const snapshot = doc;
    saveQueue.current = saveQueue.current
      .then(() => saveProject(snapshot))
      .then(() => {
        setLibrary((items) =>
          [snapshot, ...items.filter((item) => item.id !== snapshot.id)].sort(
            (a, b) => b.createdAt - a.createdAt,
          ),
        );
        if (useProjectStore.getState().doc === snapshot) {
          setSaveFailed(false);
          setSavedDoc(snapshot);
        }
      })
      .catch((cause: unknown) => {
        setSaveFailed(true);
        setError(`Your edits could not be saved: ${message(cause)}`);
      });
  }, [doc]);

  useEffect(() => {
    if (progress === null && (!doc || savedDoc === doc)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [doc, savedDoc, progress]);

  const mediaKey = doc?.source.mediaKey;
  useEffect(() => {
    let disposed = false;
    let objectUrl = '';
    setFile(null);
    setUrl('');
    setPlaying(false);
    setExported(false);
    if (!mediaKey) return;
    void new OpfsStore()
      .getFile(mediaKey)
      .then((source) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(source);
        setFile(
          new File([source], source.name, {
            type:
              useProjectStore.getState().doc?.source.mimeType ?? source.type,
          }),
        );
        setUrl(objectUrl);
      })
      .catch((cause: unknown) =>
        setError(`Could not load video: ${message(cause)}`),
      );
    return () => {
      disposed = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [mediaKey]);

  useEffect(() => {
    const element = video.current;
    if (
      element &&
      (element.currentTime < start || element.currentTime >= end)
    ) {
      element.currentTime = start;
      setTime(start);
    }
  }, [start, end]);

  const seek = useCallback(
    (value: number) => {
      const next = Math.max(start, Math.min(end, value));
      if (video.current) video.current.currentTime = next;
      setTime(next);
    },
    [start, end],
  );
  const toggle = useCallback(() => {
    const element = video.current;
    if (!element || locked) return;
    if (!element.paused) element.pause();
    else {
      if (element.currentTime >= end - 0.03) element.currentTime = start;
      void element.play().catch((cause: unknown) => setError(message(cause)));
    }
  }, [locked, start, end]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('input, select, textarea, button') ||
          event.target.isContentEditable)
      )
        return;
      if (locked || !doc) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.code === 'Space') {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (video.current) {
          const step = event.key === 'ArrowLeft' ? -1 / 30 : 1 / 30;
          seek(video.current.currentTime + step);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, locked, undo, redo, seek, toggle]);

  const importFile = async (source?: File) => {
    if (!source) return;
    setBusy(true);
    setError('');
    video.current?.pause();
    try {
      setDoc(await importVideo(source));
    } catch (cause) {
      setError(`Could not import video: ${message(cause)}`);
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  };
  const trim = (edge: 'start' | 'end', value: number) => {
    if (!doc || !Number.isFinite(value)) return;
    const next = { start, end, [edge]: value };
    if (
      next.start < 0 ||
      next.end > doc.source.durationSec ||
      next.end - next.start < 0.05
    ) {
      setError('Keep at least 0.05 seconds within the source video.');
      return;
    }
    setError('');
    updateDoc((current) => ({
      ...current,
      edit: { ...current.edit, trims: [next] },
    }));
  };
  const runExport = async () => {
    if (!doc || !file) return;
    video.current?.pause();
    setError('');
    setProgress(0);
    setExported(false);
    try {
      job.current = await exportVideo(file, doc, setProgress);
      const result = await job.current.result;
      downloadFile(
        result.file,
        `${projectName(doc).replace(/\.[^.]+$/, '')}-edited.${doc.export.container}`,
      );
      window.setTimeout(
        () => void result.cleanup().catch(() => undefined),
        60_000,
      );
      setExported(true);
    } catch (cause) {
      setError(message(cause));
    } finally {
      job.current = null;
      setProgress(null);
    }
  };

  return (
    <main className="studio">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => {
            video.current?.pause();
            setDoc(null);
            setError('');
          }}
          disabled={locked}
          aria-label="Open library"
        >
          <span className="brand-mark">OT</span>
          <h1>OpenTake</h1>
        </button>
        <span className="local-badge">
          <i /> Stored on this device
        </span>
        <button
          type="button"
          className="secondary"
          onClick={() => picker.current?.click()}
          disabled={locked}
        >
          {busy ? 'Opening…' : 'Import video'}
        </button>
        <input
          ref={picker}
          className="file-input"
          type="file"
          accept="video/*,.mkv"
          aria-label="Import video file"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </header>
      {error && (
        <div role="alert" className="error-banner">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {!doc ? (
        <section className="library">
          <div className="library-intro">
            <p className="eyebrow">LOCAL VIDEO STUDIO</p>
            <h2>Record and trim videos</h2>
            <p>Record a browser tab or import a video to edit.</p>
            <button
              type="button"
              className="primary"
              disabled={locked}
              onClick={() => picker.current?.click()}
            >
              Import video <span>↗</span>
            </button>
            <p className="record-help">
              To record, open the extension on the tab you want to capture.
            </p>
          </div>
          <section className="shelf" aria-label="Your videos">
            <div className="section-heading">
              <h3>Your videos</h3>
              <span>{library.length} saved locally</span>
            </div>
            {library.length === 0 ? (
              <div className="empty-shelf">
                <span className="empty-symbol">▤</span>
                <h3>{busy ? 'Opening your library…' : 'No videos yet'}</h3>
                <p>
                  Imported videos and finished recordings appear here.
                  <br />
                  No account. No uploads.
                </p>
              </div>
            ) : (
              <div className="video-list">
                {library.map((item, index) => (
                  <button
                    type="button"
                    className="library-item"
                    key={item.id}
                    disabled={locked}
                    onClick={() => {
                      setError('');
                      setDoc(item);
                    }}
                  >
                    <span className="item-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="item-title">
                      {projectName(item)}
                      <small>
                        {item.source.width} × {item.source.height} ·{' '}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </small>
                    </span>
                    <span>{timecode(item.source.durationSec)}</span>
                    <span>↗</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      ) : (
        <>
          <div className="project-heading">
            <div>
              <button
                type="button"
                className="back"
                onClick={() => {
                  video.current?.pause();
                  setDoc(null);
                }}
                disabled={locked}
              >
                ← Your videos
              </button>
              <h2>{projectName(doc)}</h2>
            </div>
            <span className="save-status" role="status">
              {saveFailed
                ? 'Save failed'
                : savedDoc === doc
                  ? 'Saved on this device'
                  : 'Saving…'}
            </span>
          </div>
          <div className="workbench">
            <section className="preview" aria-label="Video preview">
              <div className="preview-label">
                <span>PREVIEW</span>
                <span>
                  {doc.source.width} × {doc.source.height} ·{' '}
                  {doc.source.hasAudio ? 'With audio' : 'Silent video'}
                </span>
              </div>
              <div className="video-stage">
                {/* biome-ignore lint/a11y/useMediaCaption: User-supplied local media has no caption track. */}
                <video
                  ref={video}
                  src={url || undefined}
                  playsInline
                  preload="auto"
                  aria-label="Recorded video"
                  onLoadedMetadata={() => seek(start)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onError={() =>
                    setError(
                      'The browser could not play this video. Try another file or download the original.',
                    )
                  }
                  onTimeUpdate={() => {
                    const element = video.current;
                    if (!element) return;
                    if (element.currentTime >= end) {
                      element.pause();
                      if (element.currentTime > end + 0.001)
                        element.currentTime = end;
                    }
                    setTime(element.currentTime);
                  }}
                />
              </div>
              <div className="transport">
                <button
                  type="button"
                  className="secondary"
                  aria-label={playing ? 'Pause' : 'Play'}
                  disabled={!url || locked}
                  onClick={toggle}
                >
                  {playing ? 'Ⅱ' : '▶'}
                </button>
                <output aria-label="Current time">
                  {timecode(time)}{' '}
                  <span>/ {timecode(doc.source.durationSec)}</span>
                </output>
                <span className="transport-hint">
                  Space to play · ← → to step
                </span>
              </div>
              <div className="timeline">
                <div className="section-heading">
                  <h3>Selected clip</h3>
                  <span>{timecode(end - start)} retained</span>
                </div>
                <input
                  type="range"
                  aria-label="Timeline playhead"
                  min={start}
                  max={end}
                  step="0.001"
                  value={Math.max(start, Math.min(end, time))}
                  onChange={(event) => seek(Number(event.target.value))}
                  disabled={locked || !url}
                />
                <div className="range-labels">
                  <span>{timecode(start)}</span>
                  <span>{timecode(end)}</span>
                </div>
              </div>
            </section>
            <Inspector
              doc={doc}
              locked={locked}
              start={start}
              end={end}
              time={time}
              trim={trim}
              runExport={runExport}
              file={file}
              progress={progress}
              job={job}
              exported={exported}
            />
          </div>
        </>
      )}
      <footer>
        <span>
          OpenTake <span className="footer-dot">/</span> Local-first video
        </span>
        <span>
          Files stay in this browser. Download a copy to keep a backup.
        </span>
      </footer>
    </main>
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Editor root element is missing');
createRoot(root).render(<App />);
