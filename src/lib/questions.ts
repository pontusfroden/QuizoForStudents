import type { SourceBlock } from '../types';

export interface ParsedQuestion {
  prompt: string;
  choices: string[];
  answer: string;
  evidence: string;
  number?: string;
}
export const answerKeyHeading =
  /^[ \t]*(?:#{1,6}[ \t]*)?(?:facit|svarsförslag|lösningsförslag|answer[ \t]*key|answers|solutions)(?:[ \t]*:[ \t]*|[ \t]*[–-][ \t]*[^\r\n]+|[ \t]+(?:till|för|for|to)\b[^\r\n]*)?[ \t]*$/imu;
export function parseAnswerKey(text: string): Map<string, string> {
  const marker = answerKeyHeading.exec(text);
  const result = new Map<string, string>();
  const conflicting = new Set<string>();
  if (!marker) return result;
  let number = '',
    answer = '';
  const flush = () => {
    if (!number || !answer.trim() || conflicting.has(number)) return;
    if (result.has(number) && result.get(number) !== answer.trim()) {
      result.delete(number);
      conflicting.add(number);
    } else result.set(number, answer.trim());
  };
  for (const line of text.slice(marker.index + marker[0].length).split('\n')) {
    const match = line.match(
      /^\s*(?:(?:fråga|question|uppgift)\s+)?(\d+[a-z]?)\s*[).:\-]?(?:\s+(.+))?\s*$/iu,
    );
    if (match) {
      flush();
      number = match[1].toLowerCase();
      answer = match[2] ?? '';
    } else if (number) answer += '\n' + line;
  }
  flush();
  return result;
}

const questionStart =
  /^(?:explain|describe|compare|discuss|define|calculate|evaluate|outline|why|how|what|which|förklara|beskriv|jämför|beräkna|redogör|diskutera|motivera|resonera|analysera|ange|nämn|definiera|värdera|vad|hur|varför|vilken|vilka|vilket|punkta|lista)\b/iu;

export function isQuestion(text: string): boolean {
  return (
    text.includes('?') ||
    questionStart.test(text.trim().replace(/^(?:\d+[a-z]?[.)]|[a-z][)])\s*/iu, ''))
  );
}

export function isAdministrative(text: string): boolean {
  return /family name|personal registration|programme sheet|försättsblad|examination cover|tentamensvakt|personnummer|betygsskalan|maxpoäng|maxpo.ng|inga hjälpmedel|inga hj.lpmedel|lycka till|tentamen inneh.ller|skriv ditt namn|skriv valt svarsalternativ|nedan följer \d|nedan f.ljer \d|kurskod|tentamensdatum|inlämningstid|^(?:datum|tid|course code|program code|kursnamn|kurskod)\s*:/iu.test(
    text,
  );
}

export function isCoverPage(text: string): boolean {
  return /försättsblad|examination cover|tentamen inneh.ller[\s\S]*betyg|to be filled in[\s\S]*course code|tentamensvakt[\s\S]*provkod/iu.test(
    text,
  );
}

export function reliableText(block: SourceBlock): string {
  if (
    isCoverPage(block.text) ||
    /family\s*name|personal\s*registration|programme\s*sheet/iu.test(block.text)
  )
    return '';
  if (block.method === 'ocr' && (block.confidence ?? 100) < 70) return '';
  const letters = block.text.match(/\p{L}/gu)?.length ?? 0;
  const corrupted = block.text.match(/[\uFFFD\uE000-\uF8FF]/gu)?.length ?? 0;
  if (corrupted > Math.max(2, letters * 0.003)) return '';
  return block.text
    .split('\n')
    .filter((line) => !isAdministrative(line))
    .join('\n')
    .trim();
}

function parseGroup(group: string, numbered = false, number?: string): ParsedQuestion[] {
  const raw = group.trim();
  if (raw.length < 8 || raw.length > 6000) return [];
  const answerMatch = raw.match(
    /(?:^|\n)\s*(?:svar|answer|facit|solution|lösning)\s*:\s*([\s\S]+)$/iu,
  );
  let body = answerMatch ? raw.slice(0, answerMatch.index).trim() : raw;
  body = body.replace(/^\s*(?:\d+[a-z]?[.)]|[a-z][)])\s*/iu, '');
  const optionMatches = [...body.matchAll(/(?:^|\n|\s)([a-f])[).:]?\s+(?=\p{Lu}|\d)/gu)];
  const ordered =
    optionMatches.length >= 2 && optionMatches[0][1] === 'a' && optionMatches[1][1] === 'b';
  if (ordered) {
    const stem = body.slice(0, optionMatches[0].index).trim();
    const choices = optionMatches.map((match, index) =>
      body
        .slice(match.index! + match[0].length, optionMatches[index + 1]?.index ?? body.length)
        .trim(),
    );
    // Lettered subquestions also use a/b/c. Only treat them as options when the stem
    // is a question or an unfinished statement, not an instruction to answer subparts.
    if (
      stem.length >= 8 &&
      !/delfråg|nedanstående frågor|nedanst.ende fr.gor|besvara|each part|subquestion/iu.test(stem)
    ) {
      const key = answerMatch?.[1].trim() ?? '';
      const letter = key.match(/^([a-f])(?:[).:]|\s|$)/iu)?.[1]?.toLowerCase();
      const answer = letter ? (choices[letter.charCodeAt(0) - 97] ?? '') : key;
      return [{ prompt: stem, choices, answer, evidence: raw, number }];
    }
    return choices
      .filter(isQuestion)
      .map((prompt) => ({ prompt, choices: [], answer: '', evidence: prompt }));
  }
  const subparts = body.split(/\n\s*[a-z][)]\s+/iu);
  if (subparts.length > 1) return subparts.flatMap((part) => parseGroup(part));
  const prompt = body.replace(/\s*Förväntad svarslängd[\s\S]*$/iu, '').trim();
  if (!numbered && !isQuestion(prompt) && !/[:：]\s*$/.test(prompt)) return [];
  return [{ prompt, choices: [], answer: answerMatch?.[1].trim() ?? '', evidence: raw, number }];
}

export function parseQuestions(text: string): ParsedQuestion[] {
  text = text.split(answerKeyHeading)[0];
  const normalized = text
    .replace(/\r/g, '')
    .replace(/\s+(?=(?:Fråga|Question|Uppgift)\s+\d+\b)/giu, '\n')
    .replace(/\s+(?=\d{1,3}\s*\(\d+\s*p\))/giu, '\n');
  const lines = normalized.split('\n');
  const groups: { text: string; numbered: boolean; number?: string }[] = [];
  let current = '';
  let numbered = false;
  let number: string | undefined;
  for (const line of lines) {
    const heading = line.match(
      /^\s*(?:(?:Fråga|Question|Uppgift)\s+(\d+)\b|(\d{1,3})\s*\(\d+\s*p\)|(\d{1,3})[.)]\s+)/iu,
    );
    if (heading) {
      if (current) groups.push({ text: current, numbered, number });
      current = line.slice(heading[0].length).replace(/^\s*\(\d+\s*p\)\s*/iu, '');
      numbered = true;
      number = heading[1] ?? heading[2] ?? heading[3];
    } else if (!numbered && isQuestion(line) && current) {
      groups.push({ text: current, numbered, number });
      current = line;
    } else current += '\n' + line;
  }
  if (current) groups.push({ text: current, numbered, number });
  // Unnumbered FAQ-style questions can be separated by paragraph breaks.
  return groups
    .flatMap((group) => parseGroup(group.text, group.numbered, group.number))
    .filter((question) => question.prompt.length <= 2500);
}
