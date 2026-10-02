import type { Worker } from 'tesseract.js';
import { t } from './i18n';

export type OcrLanguage = 'eng' | 'swe' | 'swe+eng';
export interface ExtractOptions {
  ocrMode?: 'auto' | 'off' | 'all';
  language?: OcrLanguage;
  signal?: AbortSignal;
}
export function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Reading cancelled.', 'AbortError');
}
export function withTimeout<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  milliseconds = 90_000,
): Promise<T> {
  checkCancelled(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException('Reading cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(t('OCR took too long on this page. Try a smaller PDF or a clearer scan.')));
    }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}
export function hasVisibleInk(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d')!;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  // Check every pixel: sampling could miss thin lines and pale handwriting.
  // Only skip an effectively white render; sparse content still deserves OCR.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && Math.min(data[i], data[i + 1], data[i + 2]) < 250) return true;
  }
  return false;
}
export function previewImage(canvas: HTMLCanvasElement): string {
  const preview = document.createElement('canvas');
  const scale = Math.min(1, 1200 / Math.max(canvas.width, canvas.height));
  preview.width = Math.max(1, Math.round(canvas.width * scale));
  preview.height = Math.max(1, Math.round(canvas.height * scale));
  preview.getContext('2d')!.drawImage(canvas, 0, 0, preview.width, preview.height);
  const image = preview.toDataURL('image/jpeg', 0.8);
  preview.width = preview.height = 0;
  return image;
}
export function createOcrReader(language: OcrLanguage, signal?: AbortSignal) {
  let workerPromise: Promise<Worker> | undefined;
  let progress: ((message: string) => void) | undefined;
  let stopped = false;
  const close = async () => {
    stopped = true;
    signal?.removeEventListener('abort', abort);
    // Attach cleanup without waiting indefinitely if worker initialisation has stalled.
    void workerPromise?.then((worker) => worker.terminate()).catch(() => {});
  };
  const abort = () => {
    void close();
  };
  signal?.addEventListener('abort', abort, { once: true });
  return {
    async recognize(canvas: HTMLCanvasElement, onProgress?: (message: string) => void) {
      checkCancelled(signal);
      progress = onProgress;
      if (stopped) throw new Error('OCR worker is unavailable. Retry this file.');
      if (!workerPromise) {
        const { createWorker, OEM } = await import('tesseract.js');
        const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.origin).href;
        workerPromise = createWorker(language, OEM.LSTM_ONLY, {
          workerPath: `${base}worker.min.js`,
          corePath: base,
          langPath: base,
          workerBlobURL: false,
          logger: (event) =>
            progress?.(
              event.status === 'recognizing text'
                ? t('Reading scan · {percent}%', { percent: Math.round(event.progress * 100) })
                : t('Preparing scan reader…'),
            ),
          errorHandler: () => {},
        });
      }
      try {
        const worker = await withTimeout(workerPromise, signal);
        checkCancelled(signal);
        const result = await withTimeout(worker.recognize(canvas, { rotateAuto: true }), signal);
        return { text: result.data.text.trim(), confidence: result.data.confidence };
      } catch (error) {
        await close();
        throw error;
      }
    },
    close,
  };
}
