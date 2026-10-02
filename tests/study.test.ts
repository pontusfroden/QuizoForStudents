import { describe, expect, it } from 'vitest';
import { buildStudyContent, optionsFor, recordReview, stats, studyQueue } from '../src/lib/study';
import { demoLibrary } from '../src/lib/demo';
import { validateBackup } from '../src/lib/storage';
import type { StudySource } from '../src/types';
import { reflowPdfText } from '../src/lib/extract';

describe('source-grounded study generation', () => {
  it('recognises Swedish definition patterns and old-test instructions without changing å, ä, ö', () => {
    const notes: StudySource = {
      id: 'sv-course',
      name: 'Kursanteckningar',
      kind: 'notes',
      format: 'TXT',
      wordCount: 40,
      warnings: [],
      blocks: [
        {
          label: 'Sida 1',
          text: 'Kommunikation innebär att information överförs mellan människor genom gemensamma symboler.\nÅterkoppling är information som används för att förbättra ett systems funktion.',
        },
      ],
    };
    const exam: StudySource = {
      id: 'sv-test',
      name: 'Tentamen',
      kind: 'exam',
      format: 'TXT',
      wordCount: 30,
      warnings: [],
      blocks: [
        {
          label: 'Sida 2',
          text: '1. Redogör för hur information överförs mellan människor genom gemensamma symboler.\na) Motivera varför återkoppling förbättrar ett systems funktion.\n2. Ange hur kommunikation påverkar människor i en organisation.',
        },
      ],
    };
    const content = buildStudyContent([notes, exam]);
    expect(content.cards.filter((card) => !card.kind).map((card) => card.term)).toEqual([
      'Kommunikation',
      'Återkoppling',
    ]);
    expect(content.examPrompts).toHaveLength(3);
    expect(content.examPrompts[0].relatedCardIds).toContain(
      content.cards.find((card) => card.term === 'Kommunikation')!.id,
    );
    expect(content.examPrompts[1].prompt).toMatch(/^Motivera/);
  });
  it('rejoins wrapped PDF lines while preserving headings and numbered prompts', () => {
    expect(
      reflowPdfText(
        'Cell transport\nThe cell membrane is a selectively permeable barrier\nthat controls movement into and out of a cell.\n1. Explain the role of diffusion.',
      ),
    ).toBe(
      'Cell transport\nThe cell membrane is a selectively permeable barrier that controls movement into and out of a cell.\n1. Explain the role of diffusion.',
    );
  });
  it('keeps every answer in the source and every location resolvable', () => {
    const deck = demoLibrary().decks[0];
    expect(deck.cards.length).toBeGreaterThan(18);
    for (const card of deck.cards) {
      if (card.answerStatus !== 'missing') expect(card.evidence).toContain(card.answer);
      if (!card.kind) expect(card.prompt).toContain('______');
      expect(
        deck.sources
          .find((source) => source.id === card.sourceId)
          ?.blocks.some(
            (block) => block.label === card.location && block.text.includes(card.evidence),
          ),
      ).toBe(true);
      const options = optionsFor(card, deck.cards);
      if (card.answer) expect(options).toContain(card.answer);
      else expect(options).not.toContain('');
      expect(new Set(options).size).toBe(options.length);
    }
  });
  it('separates old-test prompts from facts and never invents an answer', () => {
    const deck = demoLibrary().decks[0];
    expect(deck.examPrompts).toHaveLength(3);
    expect(
      deck.cards
        .filter((card) => card.sourceId === 'demo-exam')
        .every(
          (card) => card.kind === 'question' && card.answerStatus === 'missing' && !card.answer,
        ),
    ).toBe(true);
    expect(deck.examPrompts[0].relatedCardIds.length).toBeGreaterThan(0);
    const onlyExam = buildStudyContent(deck.sources.filter((source) => source.kind === 'exam'));
    expect(onlyExam.cards).toHaveLength(3);
    expect(onlyExam.examPrompts.every((prompt) => prompt.relatedCardIds.length === 0)).toBe(true);
  });
  it('samples all pages rather than exhausting the first long file', () => {
    const sources: StudySource[] = Array.from({ length: 10 }, (_, index) => ({
      id: `source-${index}`,
      name: `notes-${index}`,
      kind: 'notes',
      format: 'TXT',
      wordCount: 5000,
      warnings: [],
      blocks: Array.from({ length: 10 }, (_, page) => ({
        label: `Page ${page}`,
        text: Array.from(
          { length: 12 },
          (_, line) =>
            `Concept${index}x${page}y${line} is a distinctive process that transforms energy into another useful form.`,
        ).join('\n'),
      })),
    }));
    const result = buildStudyContent(sources);
    expect(result.cards).toHaveLength(500);
    for (const source of sources)
      expect(result.cards.some((card) => card.sourceId === source.id)).toBe(true);
    for (const source of sources)
      for (const block of source.blocks)
        expect(
          result.cards.some((card) => card.sourceId === source.id && card.location === block.label),
        ).toBe(true);
  });
  it('deduplicates repeated sentences, avoids exam questions, and handles Swedish', () => {
    const text =
      'Fotosyntes är den process som omvandlar ljusenergi till kemisk energi i växter.\nFotosyntes är den process som omvandlar ljusenergi till kemisk energi i växter.\nWhat is the process that transforms light energy into chemical energy?';
    const result = buildStudyContent([
      {
        id: 'sv',
        name: 'Swedish',
        kind: 'notes',
        format: 'TXT',
        wordCount: 30,
        warnings: [],
        blocks: [{ label: 'Section 1', text }],
      },
    ]);
    expect(result.cards.filter((card) => !card.kind)).toHaveLength(1);
    expect(result.cards.find((card) => !card.kind)?.term).toBe('Fotosyntes');
    expect(result.cards.find((card) => card.kind === 'question')?.answerStatus).toBe('missing');
  });
});
describe('progress and retention', () => {
  it('schedules practice and only marks a concept familiar after two confident reviews', () => {
    const deck = demoLibrary().decks[0];
    const card = deck.cards[0];
    const first = recordReview(undefined, true, 1000);
    expect(first.due).toBe(601000);
    deck.progress[card.id] = first;
    expect(stats(deck).familiar).toBe(0);
    deck.progress[card.id] = recordReview(first, true, 2000);
    expect(stats(deck).familiar).toBe(1);
    const missed = recordReview(deck.progress[card.id], false, 3000);
    expect(missed.streak).toBe(0);
    expect(missed.due).toBe(63000);
    expect(missed.attempts).toBe(3);
  });
  it('puts missed concepts first and excludes unseen cards from weak-only review', () => {
    const deck = demoLibrary().decks[0];
    deck.progress[deck.cards[5].id] = recordReview(undefined, false);
    expect(studyQueue(deck)[0].id).toBe(deck.cards[5].id);
    expect(studyQueue(deck, true)).toHaveLength(1);
  });
});
describe('backup validation', () => {
  it('accepts valid source data and rejects malformed backups', () => {
    expect(validateBackup(demoLibrary()).decks).toHaveLength(1);
    expect(() => validateBackup({ version: 1, decks: [{ title: 'bad' }] })).toThrow();
    const library = demoLibrary();
    library.decks[0].cards[0].sourceId = 'missing';
    expect(() => validateBackup(library)).toThrow('invalid study cards');
  });
});
