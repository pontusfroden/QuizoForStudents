import { describe, expect, it } from 'vitest';
import { hasVisibleInk } from '../src/lib/ocr';

function canvasWithPixels(data: Uint8ClampedArray): HTMLCanvasElement {
  return {
    width: data.length / 4,
    height: 1,
    getContext: () => ({ getImageData: () => ({ data }) }),
  } as unknown as HTMLCanvasElement;
}

describe('blank page detection', () => {
  it('does not miss a thin mark between formerly sampled pixels', () => {
    const pixels = new Uint8ClampedArray(1600).fill(255);
    pixels.set([30, 30, 30, 255], 4);
    expect(hasVisibleInk(canvasWithPixels(pixels))).toBe(true);
  });
  it('sends pale writing to OCR rather than calling it blank', () => {
    expect(hasVisibleInk(canvasWithPixels(new Uint8ClampedArray([240, 240, 240, 255])))).toBe(true);
  });
  it('skips a white page without treating transparent pixels as ink', () => {
    expect(
      hasVisibleInk(canvasWithPixels(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]))),
    ).toBe(false);
  });
});
