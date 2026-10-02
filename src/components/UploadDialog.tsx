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
import type { ExtractOptions, OcrLanguage } from '../lib/ocr';
import { t } from '../lib/i18n';

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
  const [ocrMode, setOcrMode] = useState<ExtractOptions['ocrMode']>('auto');
  const [language, setLanguage] = useState<OcrLanguage>('swe+eng');
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      controller.current?.abort();
      element.close();
    };
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
        setErrors([t('Upload up to 25 files at a time.')]);
        return current;
      }
      return [
        ...current,
        ...added.map((file) => ({
          file,
          kind: /exam|test|paper|prov|tenta/i.test(file.name)
            ? ('exam' as const)
            : ('notes' as const),
        })),
      ];
    });
  }
  async function processFiles() {
    if (!title.trim()) {
      setErrors([t('Give your study set a name first.')]);
      return;
    }
    setBusy(true);
    controller.current = new AbortController();
    setErrors([]);
    const successful: StudySource[] = [];
    const failures: string[] = [];
    for (const item of files) {
      try {
        successful.push(
          await extractFile(item.file, item.kind, setMessage, {
            ocrMode,
            language,
            signal: controller.current.signal,
          }),
        );
      } catch (error) {
        if (controller.current.signal.aborted) {
          setBusy(false);
          setMessage('');
          setErrors([t('Reading cancelled. Your files are still selected.')]);
          return;
        }
        failures.push(
          error instanceof Error ? error.message : `${item.file.name}: could not read file.`,
        );
      }
    }
    if (pasted.trim()) {
      if (pasted.trim().length < 35) failures.push(t('Add at least a few sentences of notes.'));
      else
        successful.push({
          id: crypto.randomUUID(),
          name: t('Pasted notes'),
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
    else if (!failures.length) setErrors([t('Add a document or paste some notes first.')]);
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
          <span className="eyebrow">{t('YOUR NEXT LEARNING ADVENTURE')}</span>
          <h2 id="upload-title">
            {existing ? t('Add your materials') : t('Make room for a new idea.')}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label={t('Close upload')}
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <label className="field-label">
        {t('Study set name')}{' '}
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('e.g. Biology · Chapter 4')}
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
            <h3>{t('All your material. One place.')}</h3>
            <p>{t('Drop your notes, slides, and past papers here.')}</p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Plus size={16} /> {t('Choose files')}{' '}
            </button>
            <small>{t('PDF, DOCX, PPTX, TXT, MD · Up to 30 MB each')}</small>
            <input
              ref={input}
              type="file"
              multiple
              accept={SUPPORTED}
              className="visually-hidden"
              aria-label={t('Upload study files')}
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
                    <option value="notes">{t('Study notes')}</option>
                    <option value="exam">{t('Past test')}</option>
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
            <summary>{t('Or paste your notes instead')}</summary>
            <textarea
              aria-label={t('Paste study notes')}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              maxLength={100000}
              placeholder={t('Paste a few paragraphs, a chapter, or practice questions…')}
              disabled={busy}
            />
            <select
              aria-label={t('Pasted material type')}
              value={pasteKind}
              onChange={(event) => setPasteKind(event.target.value as StudySource['kind'])}
            >
              <option value="notes">{t('Study notes')}</option>
              <option value="exam">{t('Past test')}</option>
            </select>
          </details>
          <div className="scan-settings">
            <label className="field-label">
              {t('Scanned PDF pages')}
              <select
                aria-label={t('Scanned PDF pages')}
                value={ocrMode}
                disabled={busy}
                onChange={(event) => setOcrMode(event.target.value as ExtractOptions['ocrMode'])}
              >
                <option value="auto">{t('Read scanned pages automatically')}</option>
                <option value="all">{t('Read every PDF page as an image')}</option>
                <option value="off">{t('Only read embedded PDF text')}</option>
              </select>
            </label>
            <label className="field-label">
              {t('Document language')}
              <select
                aria-label={t('Document language')}
                value={language}
                disabled={busy}
                onChange={(event) => setLanguage(event.target.value as OcrLanguage)}
              >
                <option value="swe+eng">{t('Swedish + English')}</option>
                <option value="swe">{t('Swedish')}</option>
                <option value="eng">{t('English')}</option>
              </select>
            </label>
            <small>
              {t(
                'Scanned pages take longer. Text stays on your device. Handwriting and formulas may be inaccurate.',
              )}
            </small>
          </div>
          {busy && (
            <div className="reading-status" role="status">
              <LoaderCircle className="spin" size={18} />
              <p>{message || t('Reading materials…')}</p>
              <button className="text-button" onClick={() => controller.current?.abort()}>
                {t('Cancel reading')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="upload-results">
          <span className="success-icon">
            <Check />
          </span>
          <h3>
            {results.some((source) => source.coverage?.unreadPages.length) || errors.length
              ? t('Some materials need a review.')
              : t('Your materials are ready.')}
          </h3>
          {results.some((source) => source.coverage?.unreadPages.length) && (
            <p className="warning-text">
              {t('Some pages were not read. Review the details below before studying.')}
            </p>
          )}
          <p>
            {t('{count} documents · {words} words extracted', {
              count: results.length,
              words: results.reduce((sum, s) => sum + s.wordCount, 0).toLocaleString(),
            })}
          </p>
          {results.map((source) => (
            <div className="result-file" key={source.id}>
              <FileText size={18} />
              <div>
                <strong>{source.name}</strong>
                <small>
                  {source.coverage
                    ? t('{read} of {total} pages read', {
                        read: source.coverage.textPages + source.coverage.ocrPages,
                        total: source.coverage.totalPages,
                      })
                    : `${source.blocks.length} ${t('sections')}`}{' '}
                  · {source.kind === 'exam' ? t('Past test') : t('Study notes')}
                </small>
                {!!source.coverage?.ocrPages && (
                  <small>
                    {t(
                      source.coverage.ocrPages === 1
                        ? '{count} page read with OCR'
                        : '{count} pages read with OCR',
                      { count: source.coverage.ocrPages },
                    )}
                  </small>
                )}
                {source.warnings.length > 0 && (
                  <details className="extraction-notes">
                    <summary>{t('Show extraction notes')}</summary>
                    {source.warnings.map((warning, index) => (
                      <small className="warning-text" key={index}>
                        {warning}
                      </small>
                    ))}
                  </details>
                )}
              </div>
            </div>
          ))}
          <button className="text-button" onClick={() => setResults(null)}>
            {t('Back to files')}{' '}
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
          <Check size={14} /> {t('Processed on this device. No account needed.')}{' '}
        </small>
        {results ? (
          <button className="button primary" onClick={() => onSave(title.trim(), results)}>
            {t('Let’s study')} <ArrowRight size={16} />
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
                <span>{t('Reading materials…')}</span>
              </>
            ) : (
              <>
                {t('Build my study set')} <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
      </div>
    </dialog>
  );
}
