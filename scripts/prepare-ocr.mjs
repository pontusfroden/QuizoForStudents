import { copyFile, cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const output = resolve('public/ocr');
await mkdir(output, { recursive: true });
const coreDirectory = dirname(require.resolve('tesseract.js-core/package.json'));
for (const name of await readdir(coreDirectory)) {
  if (name.endsWith('.wasm') || name.endsWith('.wasm.js')) {
    await copyFile(join(coreDirectory, name), join(output, name));
  }
}
await copyFile(require.resolve('tesseract.js/dist/worker.min.js'), join(output, 'worker.min.js'));
for (const language of ['eng', 'swe']) {
  const directory = dirname(require.resolve(`@tesseract.js-data/${language}/package.json`));
  await copyFile(
    join(directory, '4.0.0_best_int', `${language}.traineddata.gz`),
    join(output, `${language}.traineddata.gz`),
  );
}
const pdfDirectory = dirname(require.resolve('pdfjs-dist/package.json'));
for (const directory of ['wasm', 'cmaps', 'standard_fonts', 'iccs']) {
  await cp(join(pdfDirectory, directory), resolve('public/pdfjs', directory), { recursive: true });
}
console.log('Prepared local OCR languages and PDF image decoders, fonts, and character maps.');
