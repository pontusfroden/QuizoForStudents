import type { StudyCard, StudySource } from '../types';
import {
  answerKeyHeading,
  isQuestion,
  parseAnswerKey,
  parseQuestions,
  reliableText,
  type ParsedQuestion,
} from './questions';

function normalized(text: string) {
  return text.toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}
function fileIdentity(name: string) {
  const ignored = new Set([
    'facit',
    'svar',
    'svarsforslag',
    'losningsforslag',
    'solutions',
    'solution',
    'answers',
    'answer',
    'key',
    'tenta',
    'tentamen',
    'exam',
    'test',
  ]);
  return (
    name
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[a-z]+|\d+/g) ?? []
  )
    .filter((token) => !ignored.has(token))
    .join(' ');
}
export function sourceAnswerIndex(sources: StudySource[]) {
  const documents = sources.map((source) => {
    const full = source.blocks.map(reliableText).join('\n');
    const hasQuestions = parseQuestions(full).some(
      (question) => question.choices.length || isQuestion(question.prompt),
    );
    const namedKey = /facit|svarsförslag|lösningsförslag|answer.?key|solutions/iu.test(source.name);
    const isKeyFile = namedKey && !hasQuestions && parseAnswerKey('Facit\n' + full).size > 0;
    let inKey = isKeyFile;
    const keyTexts: string[] = [];
    const studyBlocks: boolean[] = [];
    const texts = source.blocks.map((block) => {
      const text = reliableText(block);
      const marker = answerKeyHeading.exec(text);
      const studyText = inKey ? '' : marker ? text.slice(0, marker.index) : text;
      studyBlocks.push(!inKey && (!marker || !!studyText.trim()));
      keyTexts.push(inKey ? text : marker ? text.slice(marker.index + marker[0].length) : '');
      if (marker) inKey = true;
      return studyText;
    });
    const keys = parseAnswerKey(
      isKeyFile && !answerKeyHeading.test(full) ? 'Facit\n' + full : full,
    );
    const questions = texts.flatMap((text, index) =>
      parseQuestions(text).map((question) => ({ question, block: source.blocks[index] })),
    );
    return {
      source,
      texts,
      keyTexts,
      studyBlocks,
      keys,
      questions,
      identity: fileIdentity(source.name),
    };
  });
  const questionDocuments = documents.filter((document) => document.questions.length);
  function keyedAnswer(document: (typeof documents)[number], question: ParsedQuestion) {
    const key = question.number && document.keys.get(question.number.toLowerCase());
    if (!key) return undefined;
    const letter = key.match(/^([a-f])(?:[).:]|\s|$)/iu)?.[1]?.toLowerCase();
    const answer =
      letter && question.choices.length ? question.choices[letter.charCodeAt(0) - 97] : key;
    if (!answer) return undefined;
    const entry = new RegExp(
      `^\\s*(?:(?:fråga|question|uppgift)\\s+)?${question.number}\\s*[).:\\-]?(?:\\s|$)`,
      'imu',
    );
    const blockIndex = document.keyTexts.findIndex((text) => entry.test(text));
    const block = document.source.blocks[blockIndex];
    const raw = document.keyTexts[blockIndex] ?? '';
    const start = raw.search(entry);
    const quote =
      start >= 0
        ? raw
            .slice(start)
            .trimStart()
            .split(/\n\s*(?:(?:fråga|question|uppgift)\s+)?\d+[a-z]?\s*[).:\-]?(?:\s|$)/iu)[0]
            .trim()
        : key;
    return {
      answer,
      reference: {
        sourceId: document.source.id,
        location: block?.label ?? document.source.blocks[0]?.label ?? '',
        quote,
      },
    };
  }
  return {
    texts: new Map(documents.map((document) => [document.source.id, document.texts])),
    studyBlocks: new Map(documents.map((document) => [document.source.id, document.studyBlocks])),
    resolve(
      sourceId: string,
      question: ParsedQuestion,
    ): { answer: string; reference?: StudyCard['answerReference'] } | undefined {
      if (question.answer) return { answer: question.answer };
      const own = documents.find((document) => document.source.id === sourceId)!;
      const local = keyedAnswer(own, question);
      if (local) return local;
      // Identical question text with an explicit answer is stronger than a number match.
      const explicit = documents.flatMap((document) =>
        document.questions
          .filter(
            (item) =>
              item.question.answer &&
              normalized(item.question.prompt) === normalized(question.prompt) &&
              JSON.stringify(item.question.choices) === JSON.stringify(question.choices),
          )
          .map((item) => ({
            answer: item.question.answer,
            reference: {
              sourceId: document.source.id,
              location: item.block.label,
              quote: item.question.evidence,
            },
          })),
      );
      if (
        explicit.length &&
        explicit.every((item) => normalized(item.answer) === normalized(explicit[0].answer))
      )
        return explicit[0];
      const keyDocuments = documents.filter(
        (document) =>
          document.source.id !== sourceId && !document.questions.length && document.keys.size,
      );
      const named = keyDocuments.filter(
        (document) =>
          document.identity &&
          document.identity === own.identity &&
          questionDocuments.filter((item) => item.identity === document.identity).length === 1,
      );
      const candidates = named.length
        ? named
        : questionDocuments.length === 1 && keyDocuments.length === 1
          ? keyDocuments
          : [];
      const answers = candidates
        .map((document) => keyedAnswer(document, question))
        .filter((item): item is NonNullable<typeof item> => !!item);
      return answers.length &&
        answers.every((item) => normalized(item.answer) === normalized(answers[0].answer))
        ? answers[0]
        : undefined;
    },
  };
}
