import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Sparkles, X } from 'lucide-react';
import type { StudyDeck } from '../types';
import { aiSettings, checkAi, requestAiAnswer, saveAiSettings, type AiAnswer } from '../lib/ai';
import { t, useLocale } from '../lib/i18n';

export default function AiDialog({
  deck,
  cardId,
  onAnswer,
  onClose,
}: {
  deck: StudyDeck;
  cardId?: string;
  onAnswer: (cardId: string, answer: AiAnswer) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const completedIds = useRef(new Set<string>());
  const locale = useLocale();
  const [settings, setSettings] = useState(aiSettings);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const targets = useRef(
    deck.cards.filter(
      (card) =>
        card.kind === 'question' &&
        card.answerStatus === 'missing' &&
        (!cardId || card.id === cardId),
    ),
  ).current;
  useEffect(() => {
    dialog.current?.showModal();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    try {
      saveAiSettings(settings);
    } catch {
      setError(t('AI settings could not be saved in this browser.'));
    }
  }, [settings]);
  async function connect() {
    const task = new AbortController();
    controller.current = task;
    setBusy(true);
    setError('');
    try {
      const list = await checkAi(
        settings,
        AbortSignal.any([task.signal, AbortSignal.timeout(8000)]),
      );
      setModels(list);
      setConnected(true);
      if (list.length && !list.includes(settings.model))
        setSettings((s) => ({ ...s, model: list[0] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  async function generate() {
    const task = new AbortController();
    controller.current = task;
    setBusy(true);
    setError('');
    saveAiSettings(settings);
    let completed = completedIds.current.size;
    const failures: string[] = [];
    try {
      for (const [index, card] of targets.entries()) {
        if (task.signal.aborted) break;
        if (completedIds.current.has(card.id)) continue;
        setProgress(`${index + 1} / ${targets.length} · ${card.prompt}`);
        try {
          const answer = await requestAiAnswer(settings, card, deck, locale, task.signal);
          if (!task.signal.aborted) {
            onAnswer(card.id, answer);
            completedIds.current.add(card.id);
            completed++;
          }
        } catch (err) {
          if (task.signal.aborted) break;
          failures.push(`${card.term}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      setProgress(t('{count} answers saved.', { count: completed }));
      setDone(completed === targets.length);
      if (failures.length) setError(failures.join('\n'));
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <dialog
      ref={dialog}
      className="help-dialog ai-dialog"
      aria-labelledby="ai-title"
      onCancel={onClose}
    >
      <div className="dialog-header">
        <h2 id="ai-title">
          <Sparkles size={21} /> {t('Answers with local AI')}
        </h2>
        <button className="icon-button" aria-label={t('Close AI settings')} onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="help-content">
        <p>
          {t(
            'Create concrete answers and explanations on this computer. Questions and relevant excerpts go only to your local Ollama model.',
          )}
        </p>
        <p>
          {t(
            'Allow local network access if your browser asks when checking the connection. If you blocked it, change the permission in this website’s browser settings and try again.',
          )}
        </p>
        <label className="field-label">
          {t('Local AI server')}
          <input
            value={settings.url}
            disabled={busy}
            onChange={(event) => {
              setSettings((s) => ({ ...s, url: event.target.value }));
              setConnected(false);
            }}
          />
        </label>
        <button className="button secondary" disabled={busy} onClick={connect}>
          {t('Check connection')}
        </button>
        {connected && (
          <label className="field-label">
            {t('Local model')}
            <select
              value={settings.model}
              disabled={busy}
              onChange={(event) => setSettings((s) => ({ ...s, model: event.target.value }))}
            >
              {models.map((model) => (
                <option key={model}>{model}</option>
              ))}
            </select>
          </label>
        )}
        {connected && !models.length && (
          <p>{t('No local model installed. Download a model in Ollama first.')}</p>
        )}
        <label className="field-label">
          {t('Answer length')}
          <select
            value={settings.detail ?? 'brief'}
            disabled={busy}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                detail: event.target.value as 'brief' | 'full',
              }))
            }
          >
            <option value="brief">{t('Short and quick')}</option>
            <option value="full">{t('More detailed explanations')}</option>
          </select>
        </label>
        <p>
          {t(
            'AI answers are suggestions, not a teacher’s answer key. Review the answer and its explanation before relying on it.',
          )}
        </p>
        <p>{t('{count} questions need answers.', { count: targets.length })}</p>
        {busy && (
          <p className="reading-status" role="status">
            <LoaderCircle className="spin" />
            {progress || t('Checking connection…')}
          </p>
        )}
        {!busy && progress && <p role="status">{progress}</p>}
        {error && (
          <p className="inline-error preserve-lines" role="alert">
            {error}
          </p>
        )}
        <details>
          <summary>{t('How to start local AI')}</summary>
          <p>
            {t(
              'Start Ollama, then run npm run ai in the Quizo project. Keep that terminal running. You can also open the local version of Quizo.',
            )}
          </p>
          <a href="http://127.0.0.1:3001/QuizoForStudents/" target="_blank" rel="noreferrer">
            {t('Open local Quizo')}
          </a>
        </details>
      </div>
      <div className="dialog-footer">
        {busy ? (
          <button className="button secondary" onClick={() => controller.current?.abort()}>
            {t('Cancel generation')}
          </button>
        ) : (
          <button className="button secondary" onClick={onClose}>
            {t('Close')}
          </button>
        )}
        <button
          className="button primary"
          disabled={
            busy || done || !connected || !models.includes(settings.model) || !targets.length
          }
          onClick={generate}
        >
          <Sparkles size={16} />
          {t('Create answers')}
        </button>
      </div>
    </dialog>
  );
}
