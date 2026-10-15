import type { RefObject } from 'react';
import type { ProjectDoc } from '../core/project';
import { downloadFile, type ExportJob } from './export';
import { projectName } from './library';
import { useProjectStore } from './store';

type Props = {
  doc: ProjectDoc;
  locked: boolean;
  start: number;
  end: number;
  time: number;
  trim: (edge: 'start' | 'end', value: number) => void;
  runExport: () => Promise<void>;
  file: File | null;
  progress: number | null;
  job: RefObject<ExportJob | null>;
  exported: boolean;
};
export function Inspector({
  doc,
  locked,
  start,
  end,
  time,
  trim,
  runExport,
  file,
  progress,
  job,
  exported,
}: Props) {
  const { past, future, undo, redo, updateDoc } = useProjectStore();
  return (
    <aside className="inspector" aria-label="Edit controls">
      <div className="section-heading">
        <h3>Edit video</h3>
        <div>
          <button
            type="button"
            onClick={undo}
            disabled={!past.length || locked}
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!future.length || locked}
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
      </div>
      <fieldset disabled={locked}>
        <legend>Trim your video</legend>
        <div className="field-grid">
          <button
            type="button"
            className="secondary"
            onClick={() => trim('start', time)}
          >
            Start video here
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => trim('end', time)}
          >
            End video here
          </button>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            updateDoc((current) => ({
              ...current,
              edit: {
                ...current.edit,
                trims: [{ start: 0, end: current.source.durationSec }],
              },
            }))
          }
        >
          Reset to full video
        </button>
        <p className="hint">
          Drag through the video, then choose where it starts and ends. The
          original file is kept.
        </p>
        <details className="advanced-controls">
          <summary>Precise timing</summary>
          <div className="field-grid">
            <label>
              Start (seconds)
              <input
                type="number"
                min="0"
                max={end - 0.05}
                step="0.01"
                value={Number(start.toFixed(3))}
                onChange={(event) => trim('start', event.target.valueAsNumber)}
              />
            </label>
            <label>
              End (seconds)
              <input
                type="number"
                min={start + 0.05}
                max={doc.source.durationSec}
                step="0.01"
                value={Number(end.toFixed(3))}
                onChange={(event) => trim('end', event.target.valueAsNumber)}
              />
            </label>
          </div>
        </details>
      </fieldset>
      <p className="export-summary">
        Ready to export · {(end - start).toFixed(1)} seconds
      </p>
      <button
        type="button"
        className="primary export-button"
        onClick={() => void runExport()}
        disabled={locked || !file}
      >
        {progress === null
          ? 'Export video ↗'
          : `Exporting ${Math.round(progress * 100)}%`}
      </button>
      {progress !== null && (
        <div className="export-progress">
          <progress aria-label="Export progress" value={progress} max="1" />
          <button
            type="button"
            className="text-button"
            disabled={!job.current}
            onClick={() => void job.current?.cancel()}
          >
            Cancel export
          </button>
          <p className="hint">Keep this tab open until export finishes.</p>
        </div>
      )}
      {exported && (
        <p role="status" className="success">
          Export ready. Check your downloads.
        </p>
      )}
      <details className="advanced-controls export-advanced">
        <summary>Advanced export options</summary>
        <fieldset disabled={locked}>
          <legend>Export</legend>
          <label>
            Format
            <select
              aria-label="Format"
              value={doc.export.container}
              onChange={(event) => {
                const mp4 = event.target.value === 'mp4';
                updateDoc((current) => ({
                  ...current,
                  export: {
                    ...current.export,
                    container: mp4 ? 'mp4' : 'webm',
                    videoCodec: mp4 ? 'h264' : 'vp9',
                    audioCodec: mp4 ? 'aac' : 'opus',
                  },
                }));
              }}
            >
              <option value="webm">WebM · VP9 / Opus</option>
              <option value="mp4">MP4 · H.264 / AAC</option>
            </select>
          </label>
          <label>
            Maximum height
            <select
              aria-label="Maximum height"
              value={doc.export.resolution}
              onChange={(event) =>
                updateDoc((current) => ({
                  ...current,
                  export: {
                    ...current.export,
                    resolution: Number(event.target.value) as
                      | 720
                      | 1080
                      | 1440
                      | 2160,
                  },
                }))
              }
            >
              <option value="720">720p</option>
              <option value="1080">1080p</option>
              <option value="1440">1440p</option>
              <option value="2160">2160p</option>
            </select>
          </label>
          <p className="hint">
            Original proportions. No upscaling. Encoding support depends on your
            browser.
          </p>
        </fieldset>
        <button
          type="button"
          className="text-button"
          disabled={!file || locked}
          onClick={() => {
            if (file)
              downloadFile(
                file,
                doc.source.originalName ?? `${projectName(doc)}.webm`,
              );
          }}
        >
          Download original
        </button>
      </details>
    </aside>
  );
}
