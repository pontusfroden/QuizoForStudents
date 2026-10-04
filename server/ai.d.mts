import type { Server } from 'node:http';
export interface AiQuestion {
  prompt: string;
  choices: string[];
  context: { sourceId: string; location: string; text: string }[];
  language: string;
  model: string;
  detail?: 'brief' | 'full';
}
export interface AiResult {
  status: 'ready' | 'insufficient';
  answer?: string;
  explanation: string;
  basis?: 'material' | 'general';
  model?: string;
  answerType?: 'solution' | 'approach' | 'unavailable';
  reference?: { sourceId: string; location: string; quote: string };
}
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export const answerSchema: Record<string, unknown>;
export function validateQuestion(value: unknown): AiQuestion;
export function validateAnswer(value: unknown, question: AiQuestion): AiResult;
export function generateAnswer(
  question: AiQuestion,
  fetcher?: Fetcher,
  signal?: AbortSignal,
): Promise<AiResult>;
export function createAiServer(fetcher?: Fetcher): Server;
