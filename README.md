# QuizoForStudents

A little practice. A lot more confidence.

QuizoForStudents is a browser study workspace that turns notes, presentations, and past tests into source-based practice. The first version works without accounts, API keys, or a backend. Your materials are processed on your device.

**[Open the study app](https://pontusfroden.github.io/QuizoForStudents/)**

## Try it

Explore the clearly labelled biology demo, or choose **New study set**, upload your materials, review the extracted files, then select **Let’s study**. You can mix up to 25 files in an upload. Mark old tests as **Past test**, and lectures or course notes as **Study notes**; you can change this later in My materials.

Supported files: **PDF** (including scanned pages), **DOCX**, **PPTX**, **TXT**, and **Markdown**, up to 30 MB each. You can also paste notes directly.

Choose **Svenska** in the header to use the Swedish interface. Swedish and English document text stays in its original language in quizzes and cards. Swedish definition patterns and exam-question verbs are supported.

For PDFs, scanned-page reading is on by default. Pages with little embedded text are rendered and read with local OCR in **Swedish + English**. You can select one language, force image reading for every page if a PDF has a broken text layer, or disable OCR. OCR takes longer on large documents; progress is shown per page, and reading can be cancelled. Results show pages read, OCR pages, blank pages, and unread pages. Incomplete extraction is explicitly labelled for review. Recognition is intended for printed text; review the extracted text against your original, especially formulas, tables, or handwriting.

PDF image decoders for JPEG 2000, JBIG2, and CCITT scans are included with the website, together with PDF fonts and character maps. Failed image decoding is reported as unread content, rather than a blank page. If at least half a document appears blank, or OCR reports low confidence, the upload asks you to check the original and opens the review notes; only the extracted text is available for studying.

After updating the app, already-imported sources are not automatically reprocessed because original PDFs are not stored. Use **Add materials** and re-upload affected files. Files with the same name replace their earlier extraction within that study set, preserving source IDs and progress on unchanged cards.

## Study tools

- **Quick quiz:** complete a source sentence by choosing its missing concept. Answer choices come from the same study set.
- **Flashcards:** recall an idea, reveal the original excerpt, then rate your recall.
- **Match it:** connect concepts to their definitions. A mismatch marks both concepts for another look.
- **Written recall:** explain a concept yourself, compare with the original source, then self-grade. Keyword overlap is a hint, not a grade.
- **Past-paper practice:** attempt questions extracted from old tests and compare with possible relevant source excerpts. Related excerpts are not a verified answer key. These self-ratings are saved in session history separately from card progress.
- **Focused review:** missed concepts and due cards come first. Two confident reviews make a concept “familiar”. Confident reviews are scheduled after 10 minutes, 1 day, 3 days, and 7 days; missed concepts return sooner.
- **Materials and ideas:** read extracted text, inspect source locations, search across your material, and remove individual files.
- **Backup and restore:** export materials and progress as JSON. Restore adds copies while keeping your existing sets.

## What this first version can and cannot do

This is an **extractive prototype**, not an AI tutor yet. It uses sentence segmentation, definition patterns, and keyword rules to create up to 500 cards, distributed across pages and slides. Every generated card retains its source excerpt and location. It works best with complete sentences and definitions; fragmented slides may produce few useful cards.

It does not yet synthesize long documents, create reasoning problems, automatically grade open answers, infer a marking scheme, or interpret diagrams. OCR can recover printed text in scanned PDFs; handwriting, mathematical notation, complex tables, image-only slides, speaker notes, and legacy DOC/PPT files may still need conversion or manual notes. Extraction warnings are shown; password-protected or malformed documents can fail. There is a 2-million-character extraction limit per document and a 100 MB expanded-size limit for Office archives. OCR has a timeout per page and bounds rendered page size. Old tests without matching course notes still support manual practice.

Do not treat familiarity or practice accuracy as a predicted exam score. Source errors can appear in study cards: check the source text before practicing.

## Local development

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/QuizoForStudents/`.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

Preview opens at `http://127.0.0.1:4173/QuizoForStudents/`. The repository includes core tests and desktop/mobile browser tests for uploads, study modes, persistence, backup, and source management. GitHub Actions runs those checks before deployment.

## GitHub Pages

The included workflow builds and deploys `main` to GitHub Pages. Set repository **Settings → Pages → Source** to **GitHub Actions**. Pull requests run checks without deploying. Vite's base path is `/QuizoForStudents/`; change it if the repository name changes. Deployment follows the [official Vite GitHub Pages guide](https://vite.dev/guide/static-deploy).

## Data and privacy

Uploaded originals never go to GitHub or an external API. Only extracted text, generated cards, and practice progress are stored in this browser's IndexedDB. The app has no analytics and no account system. JavaScript, fonts, and static assets load from the website and Google Fonts; study content is not sent with those requests. OCR runs in a local Web Worker using self-hosted Tesseract/WASM and Swedish/English language data from this website, prepared from locked npm packages during development and builds. OCR page images are released after reading; OCR language data may be cached locally.

Localhost and the public website have **separate storage**. Export/restore a backup to move sets between them. Browser profiles and devices also have separate storage. Clearing browser data deletes local materials. Export backups before switching devices or clearing storage; backups contain your extracted course content, so keep them private. Browser storage limits vary; the app shows a warning if a save fails. Public repository code does not contain your study material.

## Next iteration with real course files

1. Test extraction and card usefulness with a real set of lectures and old tests.
2. Improve fragmented slide handling, multilingual concept selection, and coverage based on those files.
3. Add optional AI synthesis, topic maps, and reasoning questions through a secure backend. API keys must stay on the server; GitHub Pages cannot keep a private API key.
4. Improve handwriting and mathematical notation recognition, and add verified teacher-supplied marking guides.

## Stack

React, TypeScript, Vite, PDF.js, Mammoth, JSZip, Tesseract.js, IndexedDB, Lucide, Vitest, and Playwright. Text extraction uses [PDF.js](https://mozilla.github.io/pdf.js/) and [Mammoth](https://github.com/mwilliamson/mammoth.js). OCR uses [Tesseract.js](https://github.com/naptha/tesseract.js) with [self-hosted resources](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
