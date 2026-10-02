import type { StudySource } from '../types';

export function sourceNeedsReview(source: Pick<StudySource, 'coverage' | 'blocks'>): boolean {
  if (source.blocks.some((block) => block.method === 'ocr' && (block.confidence ?? 100) < 70))
    return true;
  const coverage = source.coverage;
  if (!coverage) return false;
  return coverage.unreadPages.length > 0 || coverage.blankPages.length >= coverage.totalPages / 2;
}
