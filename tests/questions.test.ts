import { describe, expect, it } from 'vitest';
import { buildStudyContent } from '../src/lib/study';
import { parseQuestions } from '../src/lib/questions';
import { parseDelimited } from '../src/lib/tables';
import type { StudySource } from '../src/types';

function source(text: string, kind: StudySource['kind'] = 'exam'): StudySource {
  return {
    id: 'source',
    name: 'Test.txt',
    kind,
    format: 'TXT',
    wordCount: 50,
    warnings: [],
    blocks: [{ label: 'Page 1', text }],
  };
}

describe('practice from standalone material', () => {
  it('keeps complete Swedish multiple choice questions and never turns distractors into facts', () => {
    const text =
      'Fråga 1\nRörelseenergi beror på:\na Massan och hastigheten b Enbart färgen c Enbart temperaturen Fråga 2\nVilken enhet mäter kraft?\na Newton b Joule c Watt\nFråga 3 (5p)\nEtt fordon bromsar. Beskriv hur dess rörelseenergi förändras.';
    const result = buildStudyContent([source(text)]);
    expect(result.cards).toHaveLength(3);
    expect(
      result.cards.every((card) => card.kind === 'question' && card.answerStatus === 'missing'),
    ).toBe(true);
    expect(result.cards.find((card) => card.prompt.includes('Rörelseenergi'))?.choices).toEqual([
      'Massan och hastigheten',
      'Enbart färgen',
      'Enbart temperaturen',
    ]);
    expect(result.examPrompts).toHaveLength(3);
  });
  it('uses a supplied answer rather than asking for separate lecture notes', () => {
    const questions = parseQuestions(
      'Fråga 1\nVilken enhet mäter kraft?\na Newton\nb Joule\nc Watt\nSvar: a\nFråga 2\nVad är en kraft?\nSvar: En växelverkan som kan ändra ett föremåls rörelse.',
    );
    expect(questions).toHaveLength(2);
    expect(questions[0].answer).toBe('Newton');
    expect(questions[1].answer).toContain('växelverkan');
    const result = buildStudyContent([
      source('Vad är en kraft?\nSvar: En växelverkan som kan ändra ett föremåls rörelse.', 'notes'),
    ]);
    expect(result.cards[0].answerStatus).toBe('source');
  });
  it('creates cards from short lists and definitions in either material category', () => {
    for (const kind of ['notes', 'exam'] as const) {
      expect(
        buildStudyContent([source('Energi: förmåga att utföra arbete', kind)]).cards,
      ).toHaveLength(1);
      expect(
        buildStudyContent([
          source('Newton och rörelse\nFörsta lagen\nAndra lagen\nTredje lagen', kind),
        ]).cards.length,
      ).toBeGreaterThan(0);
      expect(
        buildStudyContent([source('Anabolism\nKatabolism\nMetabolism', kind)]).cards.length,
      ).toBeGreaterThan(0);
    }
  });
  it('keeps uncertain scans as visual recall instead of making garbled facts', () => {
    const scan = source('Family name Personal Registration Number\nxx ? % zz');
    scan.blocks[0] = {
      ...scan.blocks[0],
      method: 'ocr',
      confidence: 42,
      image: 'data:image/jpeg;base64,AA==',
    };
    const result = buildStudyContent([scan]);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].kind).toBe('image');
    expect(result.cards[0].evidence).toBe('');
    expect(result.examPrompts).toHaveLength(0);
  });
  it('excludes administrative cover sheets even when OCR confidence is high', () => {
    const scan = source('TO BE FILLED IN BY THE STUDENT\nCOURSE CODE AI1170\nPROGRAM CODE: TFARC');
    scan.blocks[0] = {
      ...scan.blocks[0],
      method: 'ocr',
      confidence: 90,
      image: 'data:image/jpeg;base64,AA==',
    };
    expect(buildStudyContent([scan]).cards).toHaveLength(0);
  });
  it('preserves quoted table cells, delimiters, and line breaks', () => {
    expect(
      parseDelimited('Begrepp,Förklaring\n"Energi, värme","Kan överföras\nmellan system"'),
    ).toEqual([
      ['Begrepp', 'Förklaring'],
      ['Energi, värme', 'Kan överföras\nmellan system'],
    ]);
  });
});
