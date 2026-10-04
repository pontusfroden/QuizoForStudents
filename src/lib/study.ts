import {
  isAdministrative,
  isCoverPage,
  isQuestion,
  parseQuestions,
  reliableText,
  type ParsedQuestion,
} from './questions';
import type { CardProgress, ExamPrompt, StudyCard, StudyDeck, StudySource } from '../types';
import { sourceAnswerIndex } from './sourceAnswers';

const stopwords = new Set(
  'the and with from this that these those their there which when where what why how have has had been being were was are for not can could would should will your you our they them its into onto about between through during such than then also each some any all both other more most less very only just does did do a an of to in is it as at by on or be if we us i s t may might must one two new first second using used use e g example examples chapter page slide notes question answer describe explain discuss compare define name list points mark marks following figure table test old past exam paper och att det den som en ett för med till är på av de har från om inte kan vad hur när eller vi du man så vid genom under samt också denna detta vilka vilket vilken'.split(
    ' ',
  ),
);
for (const word of 'finns kan ska skulle bör behöver utan eftersom därför mellan sedan innan efter både alla varje exempel fråga frågor svar sida sidor bild bilder kapitel anteckningar prov tenta tentamen poäng beskriv förklara redogör diskutera motivera resonera analysera ange nämn gäller vilket vilka denna detta dessa där här medan mycket mer mindre även över inom'.split(
  ' ',
))
  stopwords.add(word);
export function words(text: string): string[] {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
}
export function keywords(text: string): string[] {
  return words(text).filter((w) => w.length > 3 && !stopwords.has(w) && /\p{L}/u.test(w));
}
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) =>
      Array.from(new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(line), (item) =>
        item.segment.trim(),
      ),
    )
    .map((line) => line.replace(/^\s*[-•▪*]\s*/, '').trim())
    .filter(Boolean);
}
function hash(text: string): string {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0).toString(36);
}
export const GENERATION_VERSION = 6;
export function preserveAiAnswers(
  content: { cards: StudyCard[]; examPrompts: ExamPrompt[] },
  previous: StudyDeck,
  sources = previous.sources,
) {
  const sourceChanged = sources !== previous.sources;
  const cards = content.cards.map((card) => {
    const old = previous.cards.find((item) => item.id === card.id);
    if (
      card.answerStatus !== 'missing' ||
      old?.answerStatus !== 'ai' ||
      card.prompt !== old.prompt ||
      JSON.stringify(card.choices) !== JSON.stringify(old.choices)
    )
      return card;
    if (
      (old.answerType === 'unavailable' || old.answerType === 'approach') &&
      (sourceChanged || previous.generationVersion !== GENERATION_VERSION)
    )
      return card;
    if (
      old.answerReference &&
      !sources.some(
        (source) =>
          source.id === old.answerReference?.sourceId &&
          source.blocks.some(
            (block) =>
              block.label === old.answerReference?.location &&
              block.text.includes(old.answerReference.quote),
          ),
      )
    )
      return card;
    return {
      ...card,
      answer: old.answer,
      answerStatus: 'ai' as const,
      answerExplanation: old.answerExplanation,
      answerBasis: old.answerBasis,
      answerModel: old.answerModel,
      answerType: old.answerType,
      answerReference: old.answerReference,
    };
  });
  return {
    cards,
    examPrompts: content.examPrompts.map((prompt) => {
      const card = cards.find(
        (item) => item.sourceId === prompt.sourceId && item.prompt === prompt.prompt,
      );
      return card?.answerStatus === 'ai'
        ? {
            ...prompt,
            answer: card.answer,
            answerStatus: card.answerStatus,
            answerExplanation: card.answerExplanation,
            answerType: card.answerType,
          }
        : prompt;
    }),
  };
}

export function regenerateDeck(deck: StudyDeck): StudyDeck {
  if (deck.generationVersion === GENERATION_VERSION) return deck;
  const content = preserveAiAnswers(buildStudyContent(deck.sources), deck);
  return {
    ...deck,
    ...content,
    generationVersion: GENERATION_VERSION,
    progress: Object.fromEntries(
      Object.entries(deck.progress).filter(([id]) => content.cards.some((card) => card.id === id)),
    ),
  };
}

export function buildStudyContent(sources: StudySource[]): {
  cards: StudyCard[];
  examPrompts: ExamPrompt[];
} {
  const frequency = new Map<string, number>();
  for (const source of sources)
    for (const block of source.blocks)
      for (const token of keywords(reliableText(block)))
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const buckets: StudyCard[][] = [];
  const answers = sourceAnswerIndex(sources);
  const seen = new Set<string>();
  const questions: (ParsedQuestion & { sourceId: string; location: string })[] = [];
  for (const source of sources) {
    for (const [blockIndex, block] of source.blocks.entries()) {
      const text = answers.texts.get(source.id)?.[blockIndex] ?? '';
      const parsed = parseQuestions(text);
      const candidates: StudyCard[] = [];
      for (const question of parsed) {
        const solution = answers.resolve(source.id, question);
        if (solution) question.answer = solution.answer;
        const key = question.prompt.toLocaleLowerCase();
        if (seen.has(key)) continue;
        const term = questionTerm(question.prompt);
        candidates.push({
          id: hash(source.id + block.label + question.prompt),
          kind: 'question',
          term,
          prompt: question.prompt,
          answer: question.answer,
          answerStatus: question.answer ? 'source' : 'missing',
          ...(solution?.reference ? { answerReference: solution.reference } : {}),
          choices: question.choices,
          evidence: question.evidence,
          matchText: question.prompt.replace(new RegExp(escapeRegex(term), 'giu'), '[…]'),
          sourceId: source.id,
          location: block.label,
        });
        questions.push({ ...question, sourceId: source.id, location: block.label });
        seen.add(key);
      }
      for (const sentence of sentences(text)) {
        if (
          isAdministrative(sentence) ||
          isQuestion(sentence) ||
          (parsed.length > 0 && /(?:^|\s)[a-f][).:]?\s+(?=\p{Lu}|\d)/u.test(sentence)) ||
          parsed.some((q) => q.evidence.includes(sentence))
        )
          continue;
        if (sentence.length > 600 || seen.has(sentence.toLocaleLowerCase())) continue;
        const definition = sentence.match(
          /^([\p{L}\p{N}][\p{L}\p{N}\s()/-]{1,65}?)\s*(?::\s+|\s+(?:is|are|means|refers to|är|betyder|innebär|avser|utgör|definieras som)\s+)(.{2,})$/iu,
        );
        if (
          !definition &&
          (sentence.length < 35 || words(sentence).length < 7 || !/[.!]$/.test(sentence))
        )
          continue;
        let term = definition?.[1]?.trim();
        if (term && (words(term).length > 7 || words(term).every((w) => stopwords.has(w))))
          term = undefined;
        if (!term) {
          const choices = [...new Set(keywords(sentence))].sort(
            (a, b) =>
              (frequency.get(b) ?? 0) +
              Math.min(b.length, 14) / 3 -
              ((frequency.get(a) ?? 0) + Math.min(a.length, 14) / 3),
          );
          if (!choices[0]) continue;
          term = sentence.match(
            new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(choices[0])}(?![\\p{L}\\p{N}])`, 'iu'),
          )?.[0];
        }
        if (!term || term.length < 2) continue;
        candidates.push({
          id: hash(source.id + block.label + sentence),
          term,
          answer: term,
          prompt: sentence.replace(new RegExp(escapeRegex(term), 'giu'), '______'),
          evidence: sentence,
          sourceId: source.id,
          location: block.label,
        });
        seen.add(sentence.toLocaleLowerCase());
      }
      // Fragmented slides and lists are still useful: a source excerpt can be recalled
      // without pretending that a short phrase is a complete definition.
      if (!candidates.length && text.length >= 8 && !isAdministrative(text)) {
        const lines = text
          .split('\n')
          .map((line) => line.replace(/^[-•▪*]\s*/, '').trim())
          .filter((line) => /\p{L}/u.test(line));
        for (let offset = 0; offset < lines.length; offset += 4) {
          const evidence = lines.slice(offset, offset + 4).join('\n');
          if (
            evidence.length < 8 ||
            evidence.length > 1200 ||
            seen.has(evidence.toLocaleLowerCase())
          )
            continue;
          const term = lines[offset].slice(0, 100);
          const swedish = /[åäö]|\b(och|att|är|för|med)\b/iu.test(text);
          candidates.push({
            id: hash(source.id + block.label + evidence),
            kind: 'question',
            term,
            prompt: swedish
              ? `Återge huvudpunkterna om ${term}.`
              : `Recall the key points about ${term}.`,
            answer: evidence,
            answerStatus: 'source',
            evidence,
            matchText: lines.slice(offset + 1, offset + 4).join(' · ') || evidence,
            sourceId: source.id,
            location: block.label,
          });
          seen.add(evidence.toLocaleLowerCase());
        }
      }
      if (
        !candidates.length &&
        block.image &&
        !isCoverPage(block.text) &&
        answers.studyBlocks.get(source.id)?.[blockIndex]
      ) {
        candidates.push({
          id: hash(source.id + block.label + 'image'),
          kind: 'image',
          term: `${source.name} · ${block.label}`,
          prompt: '',
          answer: '',
          answerStatus: 'missing',
          evidence: '',
          sourceId: source.id,
          location: block.label,
        });
      }
      if (candidates.length) buckets.push(candidates);
    }
  }
  const cards: StudyCard[] = [];
  let index = 0;
  while (cards.length < 500 && buckets.some((bucket) => bucket.length > index)) {
    for (const bucket of buckets)
      if (bucket[index] && cards.length < 500) cards.push(bucket[index]);
    index++;
  }
  const examPrompts: ExamPrompt[] = questions.slice(0, 200).map((question) => {
    const tokens = new Set(keywords(question.prompt));
    const relatedCardIds = cards
      .filter(
        (card) =>
          card.kind !== 'image' &&
          card.answerStatus !== 'missing' &&
          card.evidence !== question.evidence,
      )
      .map((card) => ({
        id: card.id,
        score: keywords(card.evidence).filter((token) => tokens.has(token)).length,
      }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.id);
    return {
      id: hash(question.sourceId + question.prompt),
      prompt: question.prompt,
      sourceId: question.sourceId,
      location: question.location,
      relatedCardIds,
      choices: question.choices,
      answer: question.answer,
      answerStatus: question.answer ? 'source' : 'missing',
    };
  });
  return { cards, examPrompts };
}

function questionTerm(prompt: string): string {
  const quoted = prompt.match(/[“”"«]([^”"»]{3,70})[”"»]/u)?.[1];
  if (quoted) return quoted;
  const statement = prompt.match(
    /^(.{3,70}?)\s+(?:är|innebär|definieras|består|brukar|is|means|consists)\b/iu,
  )?.[1];
  if (statement && !/^(?:I|När|Idag|Hur|Vad|Vilka|Vilket|Vilken)\b/iu.test(statement))
    return statement;
  const relevant = sentences(prompt).filter(isQuestion).join(' ') || prompt;
  const tokens = [...new Set(keywords(relevant))].sort((a, b) => b.length - a.length);
  const token = tokens[0];
  return token
    ? (prompt.match(new RegExp(escapeRegex(token), 'iu'))?.[0] ?? token)
    : prompt.slice(0, 100);
}
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function optionsFor(card: StudyCard, cards: StudyCard[]): string[] {
  if (
    card.kind === 'image' ||
    card.answerStatus === 'missing' ||
    card.answerType === 'approach' ||
    card.answerType === 'unavailable'
  )
    return card.choices ?? [];
  if (card.kind === 'question')
    return card.choices?.includes(card.answer) ? shuffle(card.choices) : [];
  const alternatives = [
    ...new Set(cards.filter((c) => c.answerType !== 'unavailable').map((c) => c.answer)),
  ].filter(
    (answer) =>
      answer &&
      answer.length < 120 &&
      answer.toLocaleLowerCase() !== card.answer.toLocaleLowerCase(),
  );
  return shuffle([card.answer, ...shuffle(alternatives).slice(0, 3)]);
}
export function recordReview(
  current: CardProgress | undefined,
  correct: boolean,
  now = Date.now(),
): CardProgress {
  const streak = correct ? (current?.streak ?? 0) + 1 : 0;
  const delay = correct
    ? [10 * 60_000, 24 * 3600_000, 3 * 24 * 3600_000, 7 * 24 * 3600_000][Math.min(streak - 1, 3)]
    : 60_000;
  return {
    attempts: (current?.attempts ?? 0) + 1,
    correct: (current?.correct ?? 0) + Number(correct),
    streak,
    lastReviewed: now,
    due: now + delay,
  };
}
export function studyQueue(deck: StudyDeck, weakOnly = false): StudyCard[] {
  const usable = deck.cards.filter((card) => card.answerType !== 'unavailable');
  const available = weakOnly
    ? usable.filter((card) => {
        const p = deck.progress[card.id];
        return p && p.streak < 2;
      })
    : usable;
  return shuffle(available).sort((a, b) => {
    const pa = deck.progress[a.id],
      pb = deck.progress[b.id];
    const priority = (p: CardProgress | undefined) =>
      !p ? 1 : p.streak === 0 ? 0 : p.due <= Date.now() ? 1 : 2;
    return priority(pa) - priority(pb);
  });
}
export function stats(deck: StudyDeck) {
  const usable = deck.cards.filter((card) => card.answerType !== 'unavailable');
  const entries = usable.flatMap((card) =>
    deck.progress[card.id] ? [deck.progress[card.id]] : [],
  );
  const attempts = entries.reduce((sum, p) => sum + p.attempts, 0);
  const correct = entries.reduce((sum, p) => sum + p.correct, 0);
  const familiar = entries.filter((p) => p.streak >= 2).length;
  return {
    reviewed: entries.length,
    attempts,
    correct,
    familiar,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    mastery: usable.length ? Math.round((familiar / usable.length) * 100) : 0,
    weak: entries.filter((p) => p.streak < 2).length,
    due: usable.filter((c) => !deck.progress[c.id] || deck.progress[c.id].due <= Date.now()).length,
  };
}
