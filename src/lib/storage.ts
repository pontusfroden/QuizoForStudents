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
          (block) => typeof block.label !== 'string' || typeof block.text !== 'string',
        )
      )
        throw new Error('The backup has invalid source material.');
    for (const card of deck.cards)
      if (
        ['id', 'term', 'prompt', 'answer', 'evidence', 'sourceId', 'location'].some(
          (key) => typeof card[key as keyof typeof card] !== 'string',
        ) ||
        !deck.sources.some((source) => source.id === card.sourceId)
      )
        throw new Error('The backup has invalid study cards.');
    for (const prompt of deck.examPrompts)
      if (
        ['id', 'prompt', 'sourceId', 'location'].some(
          (key) => typeof prompt[key as keyof typeof prompt] !== 'string',
        ) ||
        !Array.isArray(prompt.relatedCardIds) ||
        prompt.relatedCardIds.some((id) => typeof id !== 'string')
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
