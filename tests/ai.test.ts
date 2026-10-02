import { describe, expect, it, vi } from 'vitest';
import { createAiServer, generateAnswer, validateAnswer, validateQuestion } from '../server/ai.mjs';
import { buildStudyContent, preserveAiAnswers, regenerateDeck } from '../src/lib/study';
import { validateBackup } from '../src/lib/storage';
import type { StudySource, StudyDeck } from '../src/types';

const question = {
  prompt: 'Vilken enhet mäter kraft?',
  choices: ['Newton', 'Joule', 'Watt'],
  context: [],
  language: 'sv',
  model: 'qwen3.5:4b',
};
const result = {
  status: 'ready',
  answer: 'Newton',
  explanation: 'Kraft mäts i newton, energi i joule och effekt i watt.',
  optionIndex: 0,
  basis: 'general',
  evidence: '',
};
describe('answers rather than generic checklists', () => {
  const source = (id: string, name: string, text: string): StudySource => ({
    id,
    name,
    format: 'TXT',
    kind: 'exam',
    wordCount: 20,
    warnings: [],
    blocks: [{ label: 'Section 1', text }],
  });
  const examText = 'Fråga 1\nVilken enhet mäter kraft?\na Newton\nb Joule\nc Watt';
  it('uses a separate uploaded answer key before AI, including its source location', () => {
    const sources = [source('exam', 'Fysik.txt', examText), source('key', 'Facit.txt', '1. a')];
    const content = buildStudyContent(sources);
    expect(content.cards).toHaveLength(1);
    expect(content.cards[0]).toMatchObject({
      answer: 'Newton',
      answerStatus: 'source',
      answerReference: { sourceId: 'key', location: 'Section 1', quote: '1. a' },
    });
    const prior: StudyDeck = {
      id: 'deck',
      title: 'Fysik',
      description: '',
      createdAt: 1,
      sources: sources.slice(0, 1),
      ...buildStudyContent(sources.slice(0, 1)),
      progress: {},
      sessions: [],
    };
    prior.cards[0] = { ...prior.cards[0], answer: 'Joule', answerStatus: 'ai' };
    expect(preserveAiAnswers(content, prior, sources).cards[0].answer).toBe('Newton');
  });
  it('does not mix identically numbered questions from different exams', () => {
    const sources = [
      source('exam1', 'Tenta 2024.txt', examText),
      source(
        'exam2',
        'Tenta 2025.txt',
        'Fråga 1\nVilken enhet mäter energi?\na Newton\nb Joule\nc Watt',
      ),
      source('key', 'Facit 2025.txt', 'Facit\n1. b'),
    ];
    const cards = buildStudyContent(sources).cards;
    expect(cards.find((card) => card.sourceId === 'exam1')?.answerStatus).toBe('missing');
    expect(cards.find((card) => card.sourceId === 'exam2')?.answer).toBe('Joule');
    const ambiguous = buildStudyContent([
      ...sources.slice(0, 2),
      source('key', 'Facit.txt', 'Facit\n1. b'),
    ]);
    expect(ambiguous.cards.every((card) => card.answerStatus === 'missing')).toBe(true);
  });
  it('keeps answer-key continuation pages out of practice and locates the key page correctly', () => {
    const paper = source('exam', 'Tenta.pdf', examText + '\nFråga 2\nFörklara vad energi innebär.');
    paper.blocks.push(
      { label: 'Page 2', text: 'Facit:\nFråga 1\na' },
      { label: 'Page 3', text: '2. Energi är förmågan att utföra arbete.' },
    );
    const cards = buildStudyContent([paper]).cards;
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      answer: 'Newton',
      answerReference: { location: 'Page 2', quote: 'Fråga 1\na' },
    });
    expect(cards[1]).toMatchObject({
      answer: 'Energi är förmågan att utföra arbete.',
      answerReference: { location: 'Page 3' },
    });
  });
  it('links a numbered answer key on a separate page without converting its entries to questions', () => {
    const source: StudySource = {
      id: 'exam',
      name: 'Exam with facit.pdf',
      format: 'PDF',
      kind: 'exam',
      wordCount: 50,
      warnings: [],
      blocks: [
        {
          label: 'Page 1',
          text: 'Fråga 1\nVilken enhet mäter kraft?\na Newton\nb Joule\nc Watt\nFråga 2\nFörklara vad energi innebär.',
        },
        { label: 'Page 2', text: 'Facit\n1. a\n2. Energi är förmågan att utföra arbete.' },
      ],
    };
    const content = buildStudyContent([source]);
    expect(content.cards).toHaveLength(2);
    expect(content.cards.map((card) => card.answer)).toEqual([
      'Newton',
      'Energi är förmågan att utföra arbete.',
    ]);
    expect(content.examPrompts.every((item) => item.answerStatus === 'source')).toBe(true);
  });
  it('retains AI explanations through regeneration and backups, but prefers a real source answer', () => {
    const source: StudySource = {
      id: 'exam',
      name: 'Exam.txt',
      format: 'TXT',
      kind: 'exam',
      wordCount: 30,
      warnings: [],
      blocks: [
        { label: 'Section 1', text: 'Vilken enhet mäter kraft?\na Newton\nb Joule\nc Watt' },
      ],
    };
    const content = buildStudyContent([source]);
    const deck: StudyDeck = {
      id: 'deck',
      title: 'Physics',
      createdAt: 1,
      description: '',
      sources: [source],
      ...content,
      progress: {},
      sessions: [],
    };
    deck.cards[0] = {
      ...deck.cards[0],
      answer: 'Newton',
      answerStatus: 'ai',
      answerExplanation: result.explanation,
      answerBasis: 'general',
      answerModel: question.model,
    };
    const migrated = regenerateDeck(deck);
    expect(migrated.cards[0].answerExplanation).toBe(result.explanation);
    expect(migrated.examPrompts[0].answerStatus).toBe('ai');
    expect(
      validateBackup({ version: 1, activeId: 'deck', decks: [migrated] }).decks[0].cards[0]
        .answerStatus,
    ).toBe('ai');
    const keyed = {
      ...source,
      blocks: [{ label: 'Section 1', text: source.blocks[0].text + '\nSvar: a' }],
    };
    expect(preserveAiAnswers(buildStudyContent([keyed]), deck, [keyed]).cards[0].answerStatus).toBe(
      'source',
    );
  });
  it('rejects invalid choices and empty responses, and never fabricates a source citation', () => {
    expect(() => validateAnswer({ ...result, optionIndex: 4 }, question)).toThrow();
    expect(() => validateAnswer({ ...result, explanation: '' }, question)).toThrow();
    expect(
      validateAnswer({ ...result, basis: 'material', evidence: 'an invented quote' }, question)
        .basis,
    ).toBe('general');
    const context = [
      { sourceId: 'notes', location: 'Page 2', text: 'En kraft mäts i enheten newton.' },
    ];
    expect(
      validateAnswer(
        { ...result, basis: 'material', evidence: context[0].text },
        { ...question, context },
      ).reference,
    ).toEqual({ sourceId: 'notes', location: 'Page 2', quote: context[0].text });
    expect(() => validateQuestion({ ...question, model: 'qwen3-cloud' })).toThrow();
  });
  it('uses the local Ollama API with a schema and preserves conditional study support without pretending to know an answer option', async () => {
    const fetcher = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ message: { content: JSON.stringify(result) }, done_reason: 'stop' }),
        ),
    );
    expect((await generateAnswer(question, fetcher)).answer).toBe('Newton');
    expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.format.properties.status.enum).toEqual(['ready', 'insufficient']);
    expect(body.messages[0].content).toContain('EMPTY CONTEXT IS NORMAL');
    expect(
      validateAnswer(
        { ...result, status: 'insufficient', answer: '', explanation: 'The figure is missing.' },
        question,
      ),
    ).toMatchObject({ status: 'ready', answerType: 'approach', answer: 'The figure is missing.' });
    expect(
      validateAnswer(
        {
          ...result,
          answer: 'Använd F = ma med massan och accelerationen från figuren.',
          answerType: 'approach',
          optionIndex: -1,
        },
        question,
      ),
    ).toMatchObject({
      answerType: 'approach',
      answer: 'Använd F = ma med massan och accelerationen från figuren.',
    });
  });
  it('blocks requests from unrelated websites and validates bodies before inference', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ models: [] })));
    const server = createAiServer(fetcher);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect(
        (await fetch(base + '/api/status', { headers: { Origin: 'https://other.example' } }))
          .status,
      ).toBe(403);
      expect(
        (
          await fetch(base + '/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
      ).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
      const status = await fetch(base + '/api/status', {
        headers: { Origin: 'https://pontusfroden.github.io' },
      });
      expect(status.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://pontusfroden.github.io',
      );
      expect(await status.json()).toEqual({ provider: 'ollama', models: [] });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
