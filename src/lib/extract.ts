import type { SourceBlock, StudySource } from '../types';

export const SUPPORTED = '.pdf,.docx,.pptx,.txt,.md';
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_TEXT_LENGTH = 2_000_000;
const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

export async function extractFile(
  file: File,
  kind: StudySource['kind'],
  onProgress?: (message: string) => void,
): Promise<StudySource> {
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`${file.name}: the file limit is 30 MB. Split it into smaller files.`);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['pdf', 'docx', 'pptx', 'txt', 'md'].includes(extension))
    throw new Error(`${file.name}: use PDF, DOCX, PPTX, TXT, or Markdown.`);
  onProgress?.(`Reading ${file.name}…`);
  const data = await file.arrayBuffer();
  const warnings: string[] = [];
  let blocks: SourceBlock[] = [];
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const loadingTask = pdfjs.getDocument({ data });
    const document = await loadingTask.promise;
    let extractedLength = 0;
    try {
      for (let i = 1; i <= document.numPages; i++) {
        onProgress?.(`${file.name} · page ${i} of ${document.numPages}`);
        const page = await document.getPage(i);
        const content = await page.getTextContent();
        const text = reflowPdfText(
          content.items
            .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
            .join('')
            .trim(),
        );
        if (text) blocks.push({ label: `Page ${i}`, text });
        else
          warnings.push(`Page ${i} has no selectable text. Scanned pages need OCR before upload.`);
        extractedLength += text.length;
        if (extractedLength > MAX_TEXT_LENGTH)
          throw new Error('This PDF contains too much text. Split it into smaller documents.');
        page.cleanup();
      }
    } finally {
      await loadingTask.destroy();
    }
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
      `${file.name}: no usable text found. Upload a text-based document; scanned images need OCR first.`,
    );
  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    format: extension.toUpperCase(),
    blocks,
    warnings,
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
