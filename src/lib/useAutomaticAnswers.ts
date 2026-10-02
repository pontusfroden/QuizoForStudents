import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Library, StudyDeck } from '../types';
import { AiUnavailableError, aiSettings, applyAiAnswer, checkAi, requestAiAnswer } from './ai';
import { t, type Locale } from './i18n';

// Source arrays stay unchanged when only answers or study progress change.
// A new upload/replacement invalidates in-flight answers and allows a fresh attempt.
export function useAutomaticAnswers(
  library: Library | null,
  setLibrary: Dispatch<SetStateAction<Library | null>>,
  locale: Locale,
  paused: boolean,
) {
  const latest = useRef({ library, locale, paused });
  latest.current = { library, locale, paused };
  const worker = useRef(false);
  const mounted = useRef(false);
  const task = useRef<{ controller: AbortController; deck: StudyDeck } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attempts = useRef(new WeakMap<StudyDeck['sources'], Set<string>>());
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState({ running: false, deckId: '', prompt: '', error: '' });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      task.current?.controller.abort();
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (
      task.current &&
      (paused ||
        !library?.decks.some(
          (deck) => deck.id === task.current?.deck.id && deck.sources === task.current.deck.sources,
        ))
    )
      task.current.controller.abort();
    if (!library || paused || worker.current) return;
    const next = () => {
      const decks = latest.current.library?.decks ?? [];
      const ordered = [...decks].sort(
        (a, b) =>
          Number(b.id === latest.current.library?.activeId) -
          Number(a.id === latest.current.library?.activeId),
      );
      for (const deck of ordered) {
        if (deck.isDemo) continue;
        let tried = attempts.current.get(deck.sources);
        if (!tried) {
          tried = new Set();
          attempts.current.set(deck.sources, tried);
        }
        const card = deck.cards.find(
          (card) =>
            card.kind === 'question' && card.answerStatus === 'missing' && !tried.has(card.id),
        );
        if (card) return { deck, card, tried };
      }
    };
    if (!next()) return;
    worker.current = true;
    clearTimeout(timer.current);
    async function prepare() {
      let connectionFailed = false;
      try {
        while (mounted.current && !latest.current.paused) {
          const job = next();
          if (!job) break;
          const { deck, card, tried } = job;
          const controller = new AbortController();
          task.current = { controller, deck };
          setStatus({ running: true, deckId: deck.id, prompt: card.prompt, error: '' });
          const settings = aiSettings();
          try {
            const models = await checkAi(
              settings,
              AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
            );
            if (!models.length)
              throw new Error(t('No local model installed. Download a model in Ollama first.'));
            if (!models.includes(settings.model)) settings.model = models[0];
          } catch (error) {
            if (controller.signal.aborted) continue;
            connectionFailed = true;
            setStatus({
              running: false,
              deckId: deck.id,
              prompt: '',
              error: error instanceof Error ? error.message : String(error),
            });
            break;
          }
          tried.add(card.id);
          try {
            const answer = await requestAiAnswer(
              settings,
              card,
              deck,
              latest.current.locale,
              controller.signal,
            );
            if (!controller.signal.aborted && mounted.current)
              setLibrary((current) =>
                current
                  ? {
                      ...current,
                      decks: current.decks.map((item) =>
                        item.id === deck.id && item.sources === deck.sources
                          ? applyAiAnswer(item, card.id, answer)
                          : item,
                      ),
                    }
                  : current,
              );
          } catch (error) {
            if (controller.signal.aborted) tried.delete(card.id);
            if (error instanceof AiUnavailableError && !controller.signal.aborted) {
              tried.delete(card.id);
              connectionFailed = true;
            }
            if (!controller.signal.aborted && mounted.current)
              setStatus({
                running: false,
                deckId: deck.id,
                prompt: '',
                error: error instanceof Error ? error.message : String(error),
              });
            if (connectionFailed) break;
          }
        }
      } finally {
        worker.current = false;
        task.current = null;
        if (mounted.current) {
          setStatus((current) => ({ ...current, running: false, prompt: '' }));
          // Resume automatically after Ollama starts, or after a dialog/source change.
          if (connectionFailed)
            timer.current = setTimeout(() => setRevision((value) => value + 1), 30_000);
          else if (next() && !latest.current.paused) setRevision((value) => value + 1);
        }
      }
    }
    void prepare();
  }, [library, locale, paused, revision, setLibrary]);
  return {
    ...status,
    retry: () => {
      attempts.current = new WeakMap();
      setRevision((value) => value + 1);
    },
  };
}
