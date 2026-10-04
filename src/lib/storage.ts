import { get, set } from 'idb-keyval';
import type { Library } from '../types';
const key = 'quizo-library-v1';
export async function loadLibrary(): Promise<Library | undefined> {
  return get<Library>(key);
}
export async function saveLibrary(library: Library): Promise<void> {
  await set(key, library);
}
export function downloadBackup(library: Library) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'quizo-study-backup.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateBackup(value: unknown): Library {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup file.');
  const library = value as Library;
  if (library.version !== 1 || !Array.isArray(library.decks) || library.decks.length > 100)
    throw new Error('This is not a supported Quizo backup.');
  for (const deck of library.decks) {
    if (
      typeof deck.id !== 'string' ||
      typeof deck.title !== 'string' ||
      !Array.isArray(deck.sources) ||
      !Array.isArray(deck.cards) ||
      !Array.isArray(deck.examPrompts) ||
      !Array.isArray(deck.sessions) ||
      !deck.progress ||
      typeof deck.progress !== 'object'
    )
      throw new Error('The backup is missing study set data.');
    for (const source of deck.sources)
      if (
        typeof source.id !== 'string' ||
        typeof source.name !== 'string' ||
        !['exam', 'notes'].includes(source.kind) ||
        typeof source.wordCount !== 'number' ||
        !Array.isArray(source.warnings) ||
        !Array.isArray(source.blocks) ||
        source.blocks.some(
          (block) =>
            typeof block.label !== 'string' ||
            typeof block.text !== 'string' ||
            (block.image !== undefined &&
              (typeof block.image !== 'string' ||
                block.image.length > 2_000_000 ||
                !/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(block.image))),
        )
      )
        throw new Error('The backup has invalid source material.');
    for (const source of deck.sources) {
      const coverage = source.coverage;
      if (
        coverage &&
        (['totalPages', 'textPages', 'ocrPages'].some(
          (key) =>
            !Number.isInteger(coverage[key as 'totalPages']) || coverage[key as 'totalPages'] < 0,
        ) ||
          !Array.isArray(coverage.unreadPages) ||
          !Array.isArray(coverage.blankPages) ||
          [...coverage.unreadPages, ...coverage.blankPages].some(
            (page) => !Number.isInteger(page) || page < 1 || page > coverage.totalPages,
          ) ||
          coverage.textPages + coverage.ocrPages > coverage.totalPages)
      )
        throw new Error('The backup has invalid PDF coverage.');
      if (
        source.blocks.some(
          (block) =>
            (block.method !== undefined && !['text', 'ocr'].includes(block.method)) ||
            (block.confidence !== undefined &&
              (!Number.isFinite(block.confidence) ||
                block.confidence < 0 ||
                block.confidence > 100)),
        )
      )
        throw new Error('The backup has invalid scan metadata.');
    }
    for (const card of deck.cards)
      if (
        ['id', 'term', 'prompt', 'answer', 'evidence', 'sourceId', 'location'].some(
          (key) => typeof card[key as keyof typeof card] !== 'string',
        ) ||
        !deck.sources.some((source) => source.id === card.sourceId) ||
        (card.kind !== undefined && !['cloze', 'question', 'image'].includes(card.kind)) ||
        (card.choices !== undefined &&
          (!Array.isArray(card.choices) ||
            card.choices.some((choice) => typeof choice !== 'string'))) ||
        (card.answerStatus !== undefined &&
          !['source', 'missing', 'ai'].includes(card.answerStatus)) ||
        (card.answerExplanation !== undefined && typeof card.answerExplanation !== 'string') ||
        (card.answerModel !== undefined && typeof card.answerModel !== 'string') ||
        (card.answerType !== undefined &&
          !['solution', 'approach', 'unavailable'].includes(card.answerType)) ||
        (card.answerBasis !== undefined && !['material', 'general'].includes(card.answerBasis)) ||
        (card.answerReference !== undefined &&
          (!card.answerReference ||
            ['sourceId', 'location', 'quote'].some(
              (key) =>
                typeof card.answerReference?.[key as keyof typeof card.answerReference] !==
                'string',
            ) ||
            !deck.sources.some((source) => source.id === card.answerReference?.sourceId))) ||
        (card.matchText !== undefined && typeof card.matchText !== 'string')
      )
        throw new Error('The backup has invalid study cards.');
    for (const prompt of deck.examPrompts)
      if (
        ['id', 'prompt', 'sourceId', 'location'].some(
          (key) => typeof prompt[key as keyof typeof prompt] !== 'string',
        ) ||
        !Array.isArray(prompt.relatedCardIds) ||
        prompt.relatedCardIds.some((id) => typeof id !== 'string') ||
        (prompt.choices !== undefined &&
          (!Array.isArray(prompt.choices) ||
            prompt.choices.some((choice) => typeof choice !== 'string'))) ||
        (prompt.answer !== undefined && typeof prompt.answer !== 'string') ||
        (prompt.answerType !== undefined &&
          !['solution', 'approach', 'unavailable'].includes(prompt.answerType))
      )
        throw new Error('The backup has invalid exam prompts.');
    for (const progress of Object.values(deck.progress))
      if (
        !progress ||
        ['attempts', 'correct', 'streak', 'lastReviewed', 'due'].some(
          (key) =>
            typeof progress[key as keyof typeof progress] !== 'number' ||
            !Number.isFinite(progress[key as keyof typeof progress]),
        )
      )
        throw new Error('The backup has invalid progress.');
    for (const session of deck.sessions)
      if (
        !session ||
        typeof session.mode !== 'string' ||
        ['time', 'correct', 'total'].some(
          (key) => typeof session[key as keyof typeof session] !== 'number',
        )
      )
        throw new Error('The backup has invalid sessions.');
  }
  if (new Set(library.decks.map((deck) => deck.id)).size !== library.decks.length)
    throw new Error('The backup has duplicate study sets.');
  if (!library.decks.some((deck) => deck.id === library.activeId))
    library.activeId = library.decks[0]?.id ?? '';
  return library;
}
