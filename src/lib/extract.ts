import type { SourceBlock, StudySource } from '../types';
import {
  checkCancelled,
  createOcrReader,
  hasVisibleInk,
  previewImage,
  withTimeout,
  type ExtractOptions,
} from './ocr';
import { t } from './i18n';

export const SUPPORTED =
  '.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.csv,.tsv,.html,.htm,.json,.odt,.xlsx';
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
  if (!extension || !SUPPORTED.split(',').includes(`.${extension}`))
    throw new Error(
      `${file.name}: ${t('Use a document, image, spreadsheet, or text file listed in the upload box.')}`,
    );
  onProgress?.(t('Reading {name}…', { name: file.name }));
  const data = await file.arrayBuffer();
  const warnings: string[] = [];
  let blocks: SourceBlock[] = [];
  let coverage: StudySource['coverage'];
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdfBase = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.origin).href;
    const loadingTask = pdfjs.getDocument({
      data,
      wasmUrl: `${pdfBase}wasm/`,
      cMapUrl: `${pdfBase}cmaps/`,
      standardFontDataUrl: `${pdfBase}standard_fonts/`,
      iccUrl: `${pdfBase}iccs/`,
      // Reject malformed page content instead of silently accepting partial rendering.
      stopAtErrors: true,
    });
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
    let previewBytes = 0;
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
        let image: string | undefined;
        const sparse = (text.match(/\p{L}/gu)?.length ?? 0) < 40;
        const corrupt =
          (text.match(/[\uFFFD\uE000-\uF8FF]/gu)?.length ?? 0) > Math.max(2, text.length * 0.003);
        const needsOcr = sparse || corrupt;
        if (needsOcr || options.ocrMode === 'all') {
          const canvas = window.document.createElement('canvas');
          let recognitionStarted = false;
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
            // PDF.js can resolve a failed image to null even with stopAtErrors enabled.
            // Check decoded objects before treating a white canvas as an empty page.
            const operators = await page.getOperatorList();
            for (let op = 0; op < operators.fnArray.length; op++) {
              const code = operators.fnArray[op];
              if (
                code !== pdfjs.OPS.paintImageXObject &&
                code !== pdfjs.OPS.paintImageXObjectRepeat
              )
                continue;
              const objectId = operators.argsArray[op][0] as string;
              const objects = objectId.startsWith('g_') ? page.commonObjs : page.objs;
              // The operator-list intent may decode a separate image from the display intent.
              // Wait for its resolution; a pending object is not a decoding failure.
              const image = await withTimeout(
                new Promise<unknown>((resolve) => objects.get(objectId, resolve)),
                options.signal,
              );
              if (!image)
                throw new Error(
                  t('A PDF image could not be decoded. This page is unread, not blank.'),
                );
            }
            if (!hasVisibleInk(canvas)) coverage.blankPages.push(i);
            else {
              if (previewBytes < 8_000_000) {
                image = previewImage(canvas);
                previewBytes += image.length;
              } else
                warnings.push(
                  t(
                    'The image preview limit was reached. Split this document to review additional images.',
                  ),
                );
              onProgress?.(
                t('{name} · scanning page {page} of {total}…', {
                  name: file.name,
                  page: i,
                  total: document.numPages,
                }),
              );
              recognitionStarted = options.ocrMode !== 'off' && !ocrFailed;
              const recognized = !recognitionStarted
                ? { text: '', confidence: 0 }
                : await ocr.recognize(canvas, (message) =>
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
              if (usable && (needsOcr || recognized.text.length > text.length)) {
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
              } else if (needsOcr) {
                coverage.unreadPages.push(i);
                text = recognized.text;
                method = 'ocr';
                confidence = recognized.confidence;
              }
            }
          } catch (error) {
            checkCancelled(options.signal);
            // A broken PDF image does not prevent reading subsequent valid pages.
            if (recognitionStarted) ocrFailed = true;
            coverage.unreadPages.push(i);
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
        if ((text || image) && !coverage.blankPages.includes(i)) {
          blocks.push({
            label: `Page ${i}`,
            text,
            method,
            ...(confidence !== undefined ? { confidence } : {}),
            ...(image ? { image } : {}),
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
              : 'Check the original PDF. Retained page images can be used for visual practice when text cannot be read.',
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
    if (coverage.blankPages.length >= coverage.totalPages / 2)
      warnings.unshift(
        t(
          'At least half the pages rendered blank. Check the original PDF before relying on this study set.',
        ),
      );
  } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension)) {
    const bitmap = await createImageBitmap(file);
    const canvas = window.document.createElement('canvas');
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const ocr = createOcrReader(options.language ?? 'swe+eng', options.signal);
    try {
      const image = previewImage(canvas);
      let text = '',
        confidence = 0;
      if (options.ocrMode !== 'off') {
        try {
          const recognized = await ocr.recognize(canvas, onProgress);
          text = reflowPdfText(recognized.text);
          confidence = recognized.confidence;
        } catch (error) {
          checkCancelled(options.signal);
          warnings.push(
            t('Image text could not be read. The original image is available for visual practice.'),
          );
        }
      }
      blocks = [{ label: 'Image 1', text, method: 'ocr', confidence, image }];
      if (confidence < 70)
        warnings.push(
          t(
            'Uncertain image text is excluded from automatic facts. Use the image for visual practice.',
          ),
        );
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 0;
      await ocr.close();
    }
  } else if (['pptx', 'docx', 'odt', 'xlsx'].includes(extension)) {
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
    } else if (extension === 'odt') {
      const file = zip.file('content.xml');
      if (!file) throw new Error(t('This file does not contain readable document content.'));
      const xml = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
      blocks = textBlocks(
        Array.from(xml.getElementsByTagName('*'))
          .filter((node) => node.localName === 'p' || node.localName === 'h')
          .map((node) => node.textContent ?? '')
          .join('\n'),
      );
    } else if (extension === 'xlsx') {
      const shared = zip.file('xl/sharedStrings.xml');
      const strings = shared
        ? Array.from(
            new DOMParser()
              .parseFromString(await shared.async('string'), 'application/xml')
              .getElementsByTagNameNS('*', 'si'),
          ).map((node) => node.textContent ?? '')
        : [];
      for (const path of Object.keys(zip.files)
        .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
        .sort()) {
        const xml = new DOMParser().parseFromString(
          await zip.file(path)!.async('string'),
          'application/xml',
        );
        const rows = Array.from(xml.getElementsByTagNameNS('*', 'row')).map((row) =>
          Array.from(row.getElementsByTagNameNS('*', 'c'))
            .map((cell) => {
              const value =
                cell.getElementsByTagNameNS('*', 'v')[0]?.textContent ??
                cell.getElementsByTagNameNS('*', 'is')[0]?.textContent ??
                '';
              return cell.getAttribute('t') === 's' ? (strings[Number(value)] ?? '') : value;
            })
            .filter(Boolean),
        );
        blocks.push({
          label: `Sheet ${path.match(/sheet(\d+)/)?.[1]}`,
          text: rows
            .map((row) =>
              row.length > 1 ? `${row[0]}: ${row.slice(1).join(' · ')}` : row.join(''),
            )
            .join('\n'),
        });
      }
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
        let text = Array.from(xml.getElementsByTagNameNS('*', 'p'))
          .map((p) =>
            Array.from(p.getElementsByTagNameNS('*', 't'))
              .map((node) => node.textContent ?? '')
              .join(''),
          )
          .join('\n')
          .trim();
        const slideNumber = path.match(/slide(\d+)/)?.[1];
        const relationshipsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
        let notesPath: string | undefined;
        if (zip.file(relationshipsPath)) {
          const relationships = new DOMParser().parseFromString(
            await zip.file(relationshipsPath)!.async('string'),
            'application/xml',
          );
          const target = Array.from(relationships.getElementsByTagNameNS('*', 'Relationship'))
            .find((node) => node.getAttribute('Type')?.endsWith('/notesSlide'))
            ?.getAttribute('Target');
          if (target) {
            const parts: string[] = [];
            for (const part of (target.startsWith('/')
              ? target.slice(1)
              : `ppt/slides/${target}`
            ).split('/')) {
              if (part === '..') parts.pop();
              else if (part !== '.') parts.push(part);
            }
            notesPath = parts.join('/');
          }
        }
        if (notesPath && zip.file(notesPath)) {
          const notes = new DOMParser().parseFromString(
            await zip.file(notesPath)!.async('string'),
            'application/xml',
          );
          text +=
            '\n' +
            Array.from(notes.getElementsByTagNameNS('*', 'p'))
              .map((paragraph) =>
                Array.from(paragraph.getElementsByTagNameNS('*', 't'))
                  .map((node) => node.textContent ?? '')
                  .join(''),
              )
              .filter((line) => !/^\d+$/.test(line))
              .join('\n');
        }
        extractedLength += text.length;
        if (extractedLength > MAX_TEXT_LENGTH)
          throw new Error('This presentation contains too much text. Split it into smaller files.');
        if (text) blocks.push({ label: `Slide ${path.match(/slide(\d+)/)?.[1]}`, text });
      }
    }
    const mediaPaths = Object.keys(zip.files).filter(
      (path) =>
        /^(?:word|ppt|xl)\/media\/|^Pictures\//.test(path) &&
        /\.(?:png|jpe?g|webp|bmp)$/i.test(path),
    );
    let previewBytes = 0;
    for (const [index, path] of mediaPaths.entries()) {
      checkCancelled(options.signal);
      if (previewBytes >= 8_000_000) {
        warnings.push(
          t(
            'The image preview limit was reached. Split this document to review additional images.',
          ),
        );
        break;
      }
      try {
        const child = await extractFile(
          new File([await zip.file(path)!.async('arraybuffer')], path.split('/').pop()!),
          kind,
          onProgress,
          options,
        );
        for (const block of child.blocks) {
          previewBytes += block.image?.length ?? 0;
          blocks.push({ ...block, label: `Image ${index + 1}` });
        }
        warnings.push(...child.warnings);
      } catch (error) {
        checkCancelled(options.signal);
        warnings.push(
          `${path}: ${error instanceof Error ? error.message : t('Image could not be read.')}`,
        );
      }
    }
  } else {
    let text = new TextDecoder().decode(data);
    if (extension === 'html' || extension === 'htm') {
      const html = new DOMParser().parseFromString(text, 'text/html');
      html.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
      html.querySelectorAll('p,li,h1,h2,h3,br,tr').forEach((node) => node.append('\n'));
      text = html.body.textContent ?? '';
    } else if (extension === 'json') {
      const value: unknown = JSON.parse(text);
      const readValue = (item: unknown, label = '', depth = 0): string => {
        if (depth > 40) throw new Error(t('This file does not contain readable document content.'));
        if (Array.isArray(item))
          return item.map((child) => readValue(child, label, depth + 1)).join('\n');
        if (item && typeof item === 'object')
          return Object.entries(item)
            .map(([key, child]) => readValue(child, label ? `${label} ${key}` : key, depth + 1))
            .join('\n');
        return label ? `${label}: ${String(item ?? '')}` : String(item ?? '');
      };
      text = readValue(value);
    } else if (extension === 'csv' || extension === 'tsv') {
      const { parseDelimited } = await import('./tables');
      text = parseDelimited(text, extension === 'tsv' ? '\t' : undefined)
        .filter((row) => row.some(Boolean))
        .map((row) => (row.length > 1 ? `${row[0]}: ${row.slice(1).join(' · ')}` : row.join('')))
        .join('\n');
    }
    blocks = textBlocks(text);
  }
  const length = blocks.reduce((sum, block) => sum + block.text.length, 0);
  if (length > MAX_TEXT_LENGTH)
    throw new Error(`${file.name}: too much text. Split it into smaller documents.`);
  if (length < 8 && !blocks.some((block) => block.image))
    throw new Error(
      `${file.name}: ${t('No usable text found.')} ${coverage && coverage.blankPages.length === coverage.totalPages ? t('The pages appear blank.') : t('Scan reading could not recover enough text. Try a clearer scan or paste the text.')}`,
    );
  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    format: extension.toUpperCase(),
    blocks,
    warnings: [...new Set(warnings)],
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
