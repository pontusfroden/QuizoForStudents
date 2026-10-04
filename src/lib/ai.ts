import type { StudyCard, StudyDeck } from '../types';
import { keywords } from './study';
import { parseQuestions, reliableText } from './questions';
import { t } from './i18n';

export interface AiSettings {
  url: string;
  model: string;
  detail?: 'brief' | 'full';
}
export interface AiAnswer {
  status: 'ready';
  answer: string;
  explanation: string;
  basis: 'material' | 'general';
  model: string;
  reference?: { sourceId: string; location: string; quote: string };
  answerType?: 'solution' | 'approach' | 'unavailable';
}
export class AiUnavailableError extends Error {}
export function applyAiAnswer(deck: StudyDeck, cardId: string, answer: AiAnswer): StudyDeck {
  const card = deck.cards.find((item) => item.id === cardId);
  if (!card || card.answerStatus !== 'missing') return deck;
  const fields = {
    answer: answer.answer,
    answerStatus: 'ai' as const,
    answerExplanation: answer.explanation,
    answerBasis: answer.basis,
    answerModel: answer.model,
    answerType: answer.answerType,
    answerReference: answer.reference,
  };
  return {
    ...deck,
    cards: deck.cards.map((item) => (item.id === cardId ? { ...item, ...fields } : item)),
    examPrompts: deck.examPrompts.map((item) =>
      item.sourceId === card.sourceId && item.prompt === card.prompt
        ? { ...item, ...fields }
        : item,
    ),
  };
}
export function aiSettings(): AiSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('quizo-local-ai') ?? 'null');
    if (saved) return saved;
  } catch {
    /* Use local defaults. */
  }
  return { url: 'http://127.0.0.1:3001/api', model: 'qwen3.5:4b' };
}
export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem('quizo-local-ai', JSON.stringify(settings));
}
function localUrl(url: string, route: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password
  )
    throw new Error(t('AI must use a local server on this computer.'));
  return `${parsed.href.replace(/\/$/, '')}/${route}`;
}
export async function checkAi(settings: AiSettings, signal?: AbortSignal): Promise<string[]> {
  let response;
  try {
    response = await fetch(localUrl(settings.url, 'status'), {
      signal: signal ?? AbortSignal.timeout(8000),
    });
  } catch {
    throw new AiUnavailableError(
      t('Local AI is unavailable. Start Ollama and the Quizo AI server.'),
    );
  }
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.models))
    throw new Error(t('Local AI is unavailable. Start Ollama and the Quizo AI server.'));
  return data.models.filter((model: unknown): model is string => typeof model === 'string');
}
export async function requestAiAnswer(
  settings: AiSettings,
  card: StudyCard,
  deck: StudyDeck,
  language: 'sv' | 'en',
  signal: AbortSignal,
): Promise<AiAnswer> {
  const context = supportingContext(card, deck);
  let response;
  try {
    response = await fetch(localUrl(settings.url, 'answer'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: settings.model,
        detail: settings.detail ?? 'brief',
        prompt: card.prompt,
        choices: card.choices ?? [],
        context,
        language,
      }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AiUnavailableError(
      t('Local AI is unavailable. Start Ollama and the Quizo AI server.'),
    );
  }
  const data = await response.json();
  if (response.status === 429 || response.status === 503)
    throw new AiUnavailableError(
      t('Local AI is busy or unavailable. Answers will resume automatically.'),
    );
  if (!response.ok)
    throw new Error(t('AI could not create an answer. Check Ollama and try again.'));
  if (data.status === 'insufficient')
    throw new Error(data.explanation || t('More course context is needed for this question.'));
  if (
    data.status !== 'ready' ||
    typeof data.answer !== 'string' ||
    !data.answer.trim() ||
    typeof data.explanation !== 'string' ||
    (!data.explanation.trim() && !['approach', 'unavailable'].includes(data.answerType)) ||
    !['material', 'general'].includes(data.basis) ||
    (data.answerType !== undefined &&
      !['solution', 'approach', 'unavailable'].includes(data.answerType)) ||
    (!['approach', 'unavailable'].includes(data.answerType) &&
      card.choices?.length &&
      !card.choices.includes(data.answer))
  )
    throw new Error(t('AI returned an unusable answer. Try again.'));
  if (
    data.reference &&
    !context.some(
      (item) =>
        item.sourceId === data.reference.sourceId &&
        item.location === data.reference.location &&
        item.text.includes(data.reference.quote),
    )
  )
    delete data.reference;
  return data;
}

export function supportingContext(card: StudyCard, deck: StudyDeck) {
  const tokens = new Set(keywords([card.prompt, ...(card.choices ?? [])].join(' ')));
  // Search the whole block, including later book paragraphs; do not truncate before ranking.
  const context = deck.sources
    .flatMap((source) =>
      source.blocks.flatMap((block) => {
        let text = reliableText(block);
        for (const q of parseQuestions(text)) text = text.replace(q.evidence, '');
        const chunks = [];
        for (let offset = 0; offset < text.length; offset += 2200) {
          chunks.push({
            sourceId: source.id,
            location: block.label,
            text: text.slice(offset, offset + 2500).trim(),
          });
        }
        return chunks;
      }),
    )
    .filter((item) => item.text.length >= 12)
    .map((item) => ({
      ...item,
      score: keywords(item.text).filter((token) => tokens.has(token)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, ...item }) => item);
  return context;
}
