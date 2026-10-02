# QuizoForStudents

A little practice. A lot more confidence.

QuizoForStudents is a browser study workspace that turns notes, presentations, and past tests into source-based practice. The first version works without accounts, API keys, or a backend. Your materials are processed on your device.

**[Open the study app](https://pontusfroden.github.io/QuizoForStudents/)**

## Try it

Explore the clearly labelled biology demo, or choose **New study set**, upload your materials, review the extracted files, then select **Let’s study**. You can mix up to 25 files in an upload. Mark old tests as **Past test**, and lectures or course notes as **Study notes**; you can change this later in My materials.

Supported files: **PDF**, **DOCX**, **PPTX**, **ODT**, **XLSX**, **TXT**, **Markdown**, **CSV/TSV**, **HTML**, **JSON**, and **PNG/JPEG/WebP/BMP** images, up to 30 MB each. You can also paste text directly. A past test, short slide, or image can be studied on its own; separate lecture notes are not required. File categories help organize your set and do not restrict study modes.

Choose **Svenska** in the header to use the Swedish interface. Swedish and English document text stays in its original language in quizzes and cards. Swedish definition patterns and exam-question verbs are supported.

For PDFs, scanned-page reading is on by default. Pages with little embedded text are rendered and read with local OCR in **Swedish + English**. You can select one language, force image reading for every page if a PDF has a broken text layer, or disable OCR. OCR takes longer on large documents; progress is shown per page, and reading can be cancelled. Results show pages read, OCR pages, blank pages, and unread pages. Incomplete extraction is explicitly labelled for review. Recognition is intended for printed text; review the extracted text against your original, especially formulas, tables, or handwriting.

PDF image decoders for JPEG 2000, JBIG2, and CCITT scans are included with the website, together with PDF fonts and character maps. Failed image decoding is reported as unread content, rather than a blank page. Uncertain OCR text is excluded from factual cards. Scanned pages and uploaded images retain local JPEG previews for visual recall, including when OCR is disabled or fails. Previews have an approximate 8 MB budget per source. Covers and administrative instructions are excluded from automatic practice. Review extraction warnings against your original.

Existing sets and restored backups automatically regenerate their cards when generation changes, preserving progress on unchanged cards. Original PDFs are not stored, so older extractions need re-uploading only to obtain new page previews or improved extraction. Use **Add materials**: files with the same name replace their earlier extraction within that study set.

## Study tools

- **Quick quiz:** answer original multiple-choice questions, complete source sentences, or write a short answer. Explicit source answers enable automatic grading; questions without a verified key use self-assessment and are never falsely marked correct.
- **Flashcards:** recall an idea, answer a full exam question, or hide and recall a source image; reveal the source answer, excerpt, image, or a checklist before rating your recall.
- **Match it:** connect concepts to definitions, topics to question excerpts, or source-page labels to images. A mismatch schedules another look.
- **Written recall:** explain a concept yourself, compare with the original source, then self-grade. Keyword overlap is a hint, not a grade.
- **Past-paper practice:** attempt complete questions with their original alternatives. Compare with an explicit source answer or related excerpts when available; otherwise use a checklist and self-assessment. Other material can also be used for written practice in this mode. These self-ratings are saved in session history separately from card progress.
- **Focused review:** missed concepts and due cards come first. Two confident reviews make a concept “familiar”. Confident reviews are scheduled after 10 minutes, 1 day, 3 days, and 7 days; missed concepts return sooner.
- **Materials and ideas:** read extracted text, inspect source locations, search across your material, and remove individual files.
- **Backup and restore:** export materials and progress as JSON. Restore adds copies while keeping your existing sets.

## What this first version can and cannot do

This is a **local, source-based study tool**, not an AI tutor yet. It parses questions and answer choices, definitions, sentences, short lists, tables, and images to create up to 500 cards distributed across your material. Questions retain their full wording and source location. Short slides do not need rewriting into complete notes. Multiple-choice alternatives are not promoted to factual statements.

It does not invent missing answers, infer a marking scheme, automatically grade essays, or understand diagrams. OCR can recover printed text; difficult handwriting and formulas remain available as visual practice rather than unreliable facts. PPTX speaker notes and embedded Office images are included, but complex layout and cross-page answer-key linking are not fully interpreted. Legacy DOC/PPT files need conversion. Password-protected, malformed, or unsupported files can fail explicitly. There is a 2-million-character extraction limit per document and a 100 MB expanded-size limit for Office archives. OCR has a timeout per page and bounds rendered page size.

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

Uploaded originals never go to GitHub or an external API. Extracted text, local JPEG previews, generated cards, and practice progress are stored in this browser's IndexedDB. The app has no analytics and no account system. JavaScript, fonts, and static assets load from the website and Google Fonts; study content is not sent with those requests. OCR runs in a local Web Worker using self-hosted Tesseract/WASM and Swedish/English language data from this website, prepared from locked npm packages during development and builds. Rendering canvases are released after reading; saved page previews and OCR language data remain locally.

Localhost and the public website have **separate storage**. Export/restore a backup to move sets between them. Browser profiles and devices also have separate storage. Clearing browser data deletes local materials. Export backups before switching devices or clearing storage; backups contain your extracted course content, so keep them private. Browser storage limits vary; the app shows a warning if a save fails. Public repository code does not contain your study material.

## Next iteration with real course files

1. Test extraction and card usefulness with a real set of lectures and old tests.
2. Improve fragmented slide handling, multilingual concept selection, and coverage based on those files.
3. Add optional AI synthesis, topic maps, and reasoning questions through a secure backend. API keys must stay on the server; GitHub Pages cannot keep a private API key.
4. Improve handwriting and mathematical notation recognition, and add verified teacher-supplied marking guides.

## Stack

React, TypeScript, Vite, PDF.js, Mammoth, JSZip, Tesseract.js, IndexedDB, Lucide, Vitest, and Playwright. Text extraction uses [PDF.js](https://mozilla.github.io/pdf.js/) and [Mammoth](https://github.com/mwilliamson/mammoth.js). OCR uses [Tesseract.js](https://github.com/naptha/tesseract.js) with [self-hosted resources](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
