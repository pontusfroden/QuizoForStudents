import type { SourceBlock, StudySource } from '../types';
import { checkCancelled, createOcrReader, hasVisibleInk, type ExtractOptions } from './ocr';
import { t } from './i18n';

export const SUPPORTED = '.pdf,.docx,.pptx,.txt,.md';
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_TEXT_LENGTH = 2_000_000;
const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

export async function extractFile(
  file: File,
  kind: StudySource['kind'],
  onProgress?: (message: string) => void,
  options: ExtractOptions = {},
): Promise<StudySource> {
  checkCancelled(options.signal);
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`${file.name}: the file limit is 30 MB. Split it into smaller files.`);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['pdf', 'docx', 'pptx', 'txt', 'md'].includes(extension))
    throw new Error(`${file.name}: use PDF, DOCX, PPTX, TXT, or Markdown.`);
  onProgress?.(t('Reading {name}…', { name: file.name }));
  const data = await file.arrayBuffer();
  const warnings: string[] = [];
  let blocks: SourceBlock[] = [];
  let coverage: StudySource['coverage'];
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const loadingTask = pdfjs.getDocument({ data });
    const document = await loadingTask.promise;
    coverage = {
      totalPages: document.numPages,
      textPages: 0,
      ocrPages: 0,
      unreadPages: [],
      blankPages: [],
    };
    const ocr = createOcrReader(options.language ?? 'swe+eng', options.signal);
    let extractedLength = 0;
    let ocrFailed = false;
    try {
      for (let i = 1; i <= document.numPages; i++) {
        checkCancelled(options.signal);
        onProgress?.(
          t('{name} · page {page} of {total}', {
            name: file.name,
            page: i,
            total: document.numPages,
          }),
        );
        const page = await document.getPage(i);
        const content = await page.getTextContent();
        let text = reflowPdfText(
          content.items
            .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
            .join('')
            .trim(),
        );
        let method: 'text' | 'ocr' = 'text';
        let confidence: number | undefined;
        const sparse = (text.match(/\p{L}/gu)?.length ?? 0) < 40;
        if (ocrFailed && sparse) coverage.unreadPages.push(i);
        else if (options.ocrMode !== 'off' && (sparse || options.ocrMode === 'all')) {
          const canvas = window.document.createElement('canvas');
          try {
            const nativeViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(
              2.5,
              2400 / Math.max(nativeViewport.width, nativeViewport.height),
            );
            const viewport = page.getViewport({ scale });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const render = page.render({ canvas, viewport, background: 'rgb(255,255,255)' });
            const cancelRender = () => render.cancel();
            options.signal?.addEventListener('abort', cancelRender, { once: true });
            try {
              await render.promise;
            } finally {
              options.signal?.removeEventListener('abort', cancelRender);
            }
            checkCancelled(options.signal);
            if (!hasVisibleInk(canvas)) coverage.blankPages.push(i);
            else {
              onProgress?.(
                t('{name} · scanning page {page} of {total}…', {
                  name: file.name,
                  page: i,
                  total: document.numPages,
                }),
              );
              const recognized = await ocr.recognize(canvas, (message) =>
                onProgress?.(
                  t('{name} · page {page}/{total} · {message}', {
                    name: file.name,
                    page: i,
                    total: document.numPages,
                    message,
                  }),
                ),
              );
              const usable =
                (recognized.text.match(/\p{L}/gu)?.length ?? 0) >= 20 &&
                recognized.confidence >= 35;
              if (usable && (sparse || recognized.text.length > text.length)) {
                text = reflowPdfText(recognized.text);
                method = 'ocr';
                confidence = recognized.confidence;
                if (confidence < 70)
                  warnings.push(
                    t(
                      'Page {page}: scan text may contain recognition errors. Check the extracted text before studying.',
                      { page: i },
                    ),
                  );
              } else if (sparse) coverage.unreadPages.push(i);
            }
          } catch (error) {
            checkCancelled(options.signal);
            ocrFailed = true;
            if (sparse) coverage.unreadPages.push(i);
            warnings.push(
              t('Page {page}: scan reading failed. {message}', {
                page: i,
                message: error instanceof Error ? error.message : 'Try uploading this page again.',
              }),
            );
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        } else if (sparse && !text) coverage.unreadPages.push(i);
        if (text && !coverage.blankPages.includes(i)) {
          blocks.push({
            label: `Page ${i}`,
            text,
            method,
            ...(confidence !== undefined ? { confidence } : {}),
          });
          if (!coverage.unreadPages.includes(i)) {
            if (method === 'ocr') coverage.ocrPages++;
            else coverage.textPages++;
          }
        }
        extractedLength += text.length;
        if (extractedLength > MAX_TEXT_LENGTH)
          throw new Error('This PDF contains too much text. Split it into smaller documents.');
        page.cleanup();
      }
    } finally {
      await ocr.close();
      await loadingTask.destroy();
    }
    if (coverage.unreadPages.length)
      warnings.unshift(
        t('{count} of {total} pages could not be fully read (pages {pages}).', {
          count: coverage.unreadPages.length,
          total: coverage.totalPages,
          pages: coverage.unreadPages.join(', '),
        }) +
          ' ' +
          t(
            options.ocrMode === 'off'
              ? 'Enable scanned-page reading and upload again.'
              : 'Check the original PDF; handwriting, diagrams, and poor scans may need manual notes.',
          ),
      );
    if (coverage.blankPages.length)
      warnings.push(
        coverage.blankPages.length === 1
          ? t('Blank page {page} skipped.', { page: coverage.blankPages[0] })
          : t('{count} blank pages skipped (pages {pages}).', {
              count: coverage.blankPages.length,
              pages: coverage.blankPages.join(', '),
            }),
      );
  } else if (extension === 'pptx' || extension === 'docx') {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(data);
    // OOXML is a ZIP container. Reject oversized decompressed files before parsing them.
    let inflatedSize = 0;
    zip.forEach((_path, entry) => {
      inflatedSize +=
        (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ??
        0;
    });
    if (inflatedSize > MAX_ARCHIVE_SIZE)
      throw new Error(
        'This document is too large after decompression. Split it into smaller files.',
      );
    if (extension === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: data });
      blocks = textBlocks(result.value);
      warnings.push(...result.messages.map((message) => message.message));
    } else {
      const slidePaths = Object.keys(zip.files)
        .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
        .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
      let extractedLength = 0;
      for (const path of slidePaths) {
        const xml = new DOMParser().parseFromString(
          await zip.file(path)!.async('string'),
          'application/xml',
        );
        const text = Array.from(xml.getElementsByTagNameNS('*', 'p'))
          .map((p) =>
            Array.from(p.getElementsByTagNameNS('*', 't'))
              .map((node) => node.textContent ?? '')
              .join(''),
          )
          .join('\n')
          .trim();
        extractedLength += text.length;
        if (extractedLength > MAX_TEXT_LENGTH)
          throw new Error('This presentation contains too much text. Split it into smaller files.');
        if (text) blocks.push({ label: `Slide ${path.match(/slide(\d+)/)?.[1]}`, text });
        else
          warnings.push(
            `Slide ${path.match(/slide(\d+)/)?.[1]} has no text. Images and speaker notes are not extracted.`,
          );
      }
    }
  } else blocks = textBlocks(new TextDecoder().decode(data));
  const length = blocks.reduce((sum, block) => sum + block.text.length, 0);
  if (length > MAX_TEXT_LENGTH)
    throw new Error(`${file.name}: too much text. Split it into smaller documents.`);
  if (length < 35)
    throw new Error(
      `${file.name}: ${t('No usable text found.')} ${coverage && coverage.blankPages.length === coverage.totalPages ? t('The pages appear blank.') : t('Scan reading could not recover enough text. Try a clearer scan or paste the text.')}`,
    );
  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    format: extension.toUpperCase(),
    blocks,
    warnings,
    ...(coverage ? { coverage } : {}),
    wordCount: blocks.reduce(
      (sum, block) => sum + block.text.split(/\s+/).filter(Boolean).length,
      0,
    ),
  };
}
export function textBlocks(text: string): SourceBlock[] {
  // Group by paragraphs, keeping individual chunks small enough to inspect comfortably.
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    if (current.length + paragraph.length > 3500 && current.trim()) {
      chunks.push(current.trim());
      current = '';
    }
    current += paragraph + '\n\n';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((text, index) => ({ label: `Section ${index + 1}`, text }));
}
export function reflowPdfText(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined[joined.length - 1];
    const wrapped =
      previous &&
      !/[.!?:;]$/.test(previous) &&
      previous.split(/\s+/).length >= 4 &&
      !/^\s*(?:\d+[.)]|[-•▪])\s/.test(line) &&
      (/^\p{Ll}/u.test(line) || previous.length > 75);
    if (wrapped) joined[joined.length - 1] += ' ' + line;
    else joined.push(line);
  }
  return joined.join('\n');
}
