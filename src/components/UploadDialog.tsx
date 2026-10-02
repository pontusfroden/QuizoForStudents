import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { extractFile, SUPPORTED, textBlocks } from '../lib/extract';
import type { StudyDeck, StudySource } from '../types';

interface Props {
  existing?: StudyDeck;
  onClose: () => void;
  onSave: (title: string, sources: StudySource[]) => void;
}
export default function UploadDialog({ existing, onClose, onSave }: Props) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [files, setFiles] = useState<{ file: File; kind: StudySource['kind'] }[]>([]);
  const [pasted, setPasted] = useState('');
  const [pasteKind, setPasteKind] = useState<StudySource['kind']>('notes');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<StudySource[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  function addFiles(incoming: FileList | File[]) {
    const incomingFiles = Array.from(incoming);
    setResults(null);
    setErrors([]);
    setFiles((current) => {
      const added = incomingFiles.filter(
        (file) =>
          !current.some((item) => item.file.name === file.name && item.file.size === file.size),
      );
      if (current.length + added.length > 25) {
        setErrors(['Upload up to 25 files at a time.']);
        return current;
      }
      return [
        ...current,
        ...added.map((file) => ({
          file,
          kind: /exam|test|paper|prov|tentamen/i.test(file.name)
            ? ('exam' as const)
            : ('notes' as const),
        })),
      ];
    });
  }
  async function processFiles() {
    if (!title.trim()) {
      setErrors(['Give your study set a name first.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    const successful: StudySource[] = [];
    const failures: string[] = [];
    for (const item of files) {
      try {
        successful.push(await extractFile(item.file, item.kind, setMessage));
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : `${item.file.name}: could not read file.`,
        );
      }
    }
    if (pasted.trim()) {
      if (pasted.trim().length < 35) failures.push('Add at least a few sentences of notes.');
      else
        successful.push({
          id: crypto.randomUUID(),
          name: 'Pasted notes',
          kind: pasteKind,
          format: 'TEXT',
          blocks: textBlocks(pasted),
          warnings: [],
          wordCount: pasted.trim().split(/\s+/).length,
        });
    }
    setBusy(false);
    setMessage('');
    setErrors(failures);
    if (successful.length) setResults(successful);
    else if (!failures.length) setErrors(['Add a document or paste some notes first.']);
  }
  return (
    <dialog
      ref={dialog}
      className="upload-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="upload-title"
    >
      <div className="dialog-header">
        <div>
          <span className="eyebrow">YOUR NEXT LEARNING ADVENTURE</span>
          <h2 id="upload-title">{existing ? 'Add your materials' : 'Make room for a new idea.'}</h2>
        </div>
        <button className="icon-button" aria-label="Close upload" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <label className="field-label">
        Study set name
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Biology · Chapter 4"
          maxLength={100}
          disabled={busy}
        />
      </label>
      {!results ? (
        <>
          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy) addFiles(event.dataTransfer.files);
            }}
          >
            <span className="drop-icon">
              <UploadCloud size={28} />
            </span>
            <h3>All your material. One place.</h3>
            <p>Drop your notes, slides, and past papers here.</p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Plus size={16} /> Choose files
            </button>
            <small>PDF, DOCX, PPTX, TXT, MD · Up to 30 MB each</small>
            <input
              ref={input}
              type="file"
              multiple
              accept={SUPPORTED}
              className="visually-hidden"
              aria-label="Upload study files"
              disabled={busy}
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
          {files.length > 0 && (
            <div className="pending-files">
              {files.map((item, index) => (
                <div className="pending-file" key={`${item.file.name}-${index}`}>
                  <FileText size={18} />
                  <span>{item.file.name}</span>
                  <select
                    aria-label={`Type for ${item.file.name}`}
                    value={item.kind}
                    disabled={busy}
                    onChange={(event) =>
                      setFiles((current) =>
                        current.map((entry, i) =>
                          i === index
                            ? { ...entry, kind: event.target.value as StudySource['kind'] }
                            : entry,
                        ),
                      )
                    }
                  >
                    <option value="notes">Study notes</option>
                    <option value="exam">Past test</option>
                  </select>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${item.file.name}`}
                    disabled={busy}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <details className="paste-details">
            <summary>Or paste your notes instead</summary>
            <textarea
              aria-label="Paste study notes"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              maxLength={100000}
              placeholder="Paste a few paragraphs, a chapter, or practice questions…"
              disabled={busy}
            />
            <select
              aria-label="Pasted material type"
              value={pasteKind}
              onChange={(event) => setPasteKind(event.target.value as StudySource['kind'])}
            >
              <option value="notes">Study notes</option>
              <option value="exam">Past test</option>
            </select>
          </details>
        </>
      ) : (
        <div className="upload-results">
          <span className="success-icon">
            <Check />
          </span>
          <h3>Your materials are ready.</h3>
          <p>
            {results.length} document{results.length !== 1 ? 's' : ''} ·{' '}
            {results.reduce((sum, s) => sum + s.wordCount, 0).toLocaleString()} words extracted
          </p>
          {results.map((source) => (
            <div className="result-file" key={source.id}>
              <FileText size={18} />
              <div>
                <strong>{source.name}</strong>
                <small>
                  {source.blocks.length} sections ·{' '}
                  {source.kind === 'exam' ? 'Past test' : 'Study notes'}
                </small>
                {source.warnings.map((warning, index) => (
                  <small className="warning-text" key={index}>
                    {warning}
                  </small>
                ))}
              </div>
            </div>
          ))}
          <button className="text-button" onClick={() => setResults(null)}>
            Back to files
          </button>
        </div>
      )}
      {errors.length > 0 && (
        <div role="alert" className="inline-error">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
      <div className="dialog-footer">
        <small>
          <Check size={14} /> Processed on this device. No account needed.
        </small>
        {results ? (
          <button className="button primary" onClick={() => onSave(title.trim(), results)}>
            Let’s study <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="button primary"
            disabled={busy || (!files.length && !pasted.trim())}
            onClick={processFiles}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={16} />
                <span>{message || 'Reading materials…'}</span>
              </>
            ) : (
              <>
                Build my study set <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
      </div>
    </dialog>
  );
}
