import type { CardProgress, ExamPrompt, StudyCard, StudyDeck, StudySource } from '../types';

const stopwords = new Set(
  'the and with from this that these those their there which when where what why how have has had been being were was are for not can could would should will your you our they them its into onto about between through during such than then also each some any all both other more most less very only just does did do a an of to in is it as at by on or be if we us i s t may might must one two new first second using used use e g example examples chapter page slide notes question answer describe explain discuss compare define name list points mark marks following figure table test old past exam paper och att det den som en ett för med till är på av de har från om inte kan vad hur när eller vi du man så vid genom under samt också denna detta vilka vilket vilken'.split(
    ' ',
  ),
);
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
export function buildStudyContent(sources: StudySource[]): {
  cards: StudyCard[];
  examPrompts: ExamPrompt[];
} {
  const frequency = new Map<string, number>();
  for (const source of sources.filter((s) => s.kind === 'notes'))
    for (const block of source.blocks)
      for (const token of keywords(block.text))
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const buckets: StudyCard[][] = [];
  const seen = new Set<string>();
  for (const source of sources.filter((s) => s.kind === 'notes'))
    for (const block of source.blocks) {
      const candidates: StudyCard[] = [];
      for (const sentence of sentences(block.text)) {
        if (
          sentence.length < 35 ||
          sentence.length > 600 ||
          sentence.endsWith('?') ||
          words(sentence).length < 7
        )
          continue;
        if (seen.has(sentence.toLocaleLowerCase())) continue;
        const definition = sentence.match(
          /^([\p{L}\p{N}][\p{L}\p{N}\s()/-]{2,65}?)\s*(?::\s+|\s+(?:is|are|means|refers to|är|betyder)\s+)(.{20,})$/iu,
        );
        let term = definition?.[1]?.trim();
        if (term && (words(term).length > 7 || words(term).every((w) => stopwords.has(w))))
          term = undefined;
        if (!term) {
          const candidates = [...new Set(keywords(sentence))].sort(
            (a, b) =>
              (frequency.get(b) ?? 0) +
              Math.min(b.length, 14) / 3 -
              ((frequency.get(a) ?? 0) + Math.min(a.length, 14) / 3),
          );
          const chosen = candidates[0];
          if (!chosen) continue;
          term = sentence.match(
            new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(chosen)}(?![\\p{L}\\p{N}])`, 'iu'),
          )?.[0];
        }
        if (!term || term.length < 3) continue;
        const prompt = sentence.replace(new RegExp(escapeRegex(term), 'giu'), '______');
        candidates.push({
          id: hash(source.id + block.label + sentence),
          term,
          answer: term,
          prompt,
          evidence: sentence,
          sourceId: source.id,
          location: block.label,
        });
        seen.add(sentence.toLocaleLowerCase());
      }
      if (candidates.length) buckets.push(candidates);
    }
  // Round-robin across every page/slide: long early documents cannot crowd out later sources.
  const cards: StudyCard[] = [];
  let index = 0;
  while (cards.length < 500 && buckets.some((bucket) => bucket.length > index)) {
    for (const bucket of buckets)
      if (bucket[index] && cards.length < 500) cards.push(bucket[index]);
    index++;
  }
  const examPrompts: ExamPrompt[] = [];
  for (const source of sources.filter((s) => s.kind === 'exam'))
    for (const block of source.blocks) {
      for (const line of sentences(block.text)) {
        const prompt = line.replace(/^\s*\d+[.)]\s*/, '').trim();
        if (
          prompt.length < 20 ||
          prompt.length > 800 ||
          !/\?|^(?:explain|describe|compare|discuss|define|calculate|evaluate|outline|why|how|what|förklara|beskriv|jämför|beräkna|vad|hur)/iu.test(
            prompt,
          )
        )
          continue;
        const tokens = new Set(keywords(prompt));
        const relatedCardIds = cards
          .map((card) => ({
            id: card.id,
            score: keywords(card.evidence).filter((token) => tokens.has(token)).length,
          }))
          .filter((item) => item.score >= 2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((item) => item.id);
        examPrompts.push({
          id: hash(source.id + prompt),
          prompt,
          sourceId: source.id,
          location: block.label,
          relatedCardIds,
        });
        if (examPrompts.length >= 200) return { cards, examPrompts };
      }
    }
  return { cards, examPrompts };
}
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function optionsFor(card: StudyCard, cards: StudyCard[]): string[] {
  const alternatives = [...new Set(cards.map((c) => c.answer))].filter(
    (answer) => answer.toLocaleLowerCase() !== card.answer.toLocaleLowerCase(),
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
  const available = weakOnly
    ? deck.cards.filter((card) => {
        const p = deck.progress[card.id];
        return p && p.streak < 2;
      })
    : deck.cards;
  return shuffle(available).sort((a, b) => {
    const pa = deck.progress[a.id],
      pb = deck.progress[b.id];
    const priority = (p: CardProgress | undefined) =>
      !p ? 1 : p.streak === 0 ? 0 : p.due <= Date.now() ? 1 : 2;
    return priority(pa) - priority(pb);
  });
}
export function stats(deck: StudyDeck) {
  const entries = Object.values(deck.progress);
  const attempts = entries.reduce((sum, p) => sum + p.attempts, 0);
  const correct = entries.reduce((sum, p) => sum + p.correct, 0);
  const familiar = entries.filter((p) => p.streak >= 2).length;
  return {
    reviewed: entries.length,
    attempts,
    correct,
    familiar,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    mastery: deck.cards.length ? Math.round((familiar / deck.cards.length) * 100) : 0,
    weak: entries.filter((p) => p.streak < 2).length,
    due: deck.cards.filter((c) => !deck.progress[c.id] || deck.progress[c.id].due <= Date.now())
      .length,
  };
}
