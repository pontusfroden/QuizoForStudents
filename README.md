# QuizoForStudents

A little practice. A lot more confidence.

QuizoForStudents is a browser study workspace that turns notes, presentations, and past tests into source-based practice. Basic practice works without accounts, API keys, or a backend; optional answers and explanations use a local Ollama service. Your materials are processed on your device.

**[Open the study app](https://pontusfroden.github.io/QuizoForStudents/)**

## Try it

Explore the clearly labelled biology demo, or choose **New study set**, upload your materials, review the extracted files, then select **Let’s study**. You can mix up to 25 files in an upload. Mark old tests as **Past test**, and lectures or course notes as **Study notes**; you can change this later in My materials.

Supported files: **PDF**, **DOCX**, **PPTX**, **ODT**, **XLSX**, **TXT**, **Markdown**, **CSV/TSV**, **HTML**, **JSON**, and **PNG/JPEG/WebP/BMP** images, up to 30 MB each. You can also paste text directly. A past test, short slide, or image can be studied on its own; separate lecture notes are not required. File categories help organize your set and do not restrict study modes.

Choose **Svenska** in the header to use the Swedish interface. Swedish and English document text stays in its original language in quizzes and cards. Swedish definition patterns and exam-question verbs are supported.

For PDFs, scanned-page reading is on by default. Pages with little embedded text are rendered and read with local OCR in **Swedish + English**. You can select one language, force image reading for every page if a PDF has a broken text layer, or disable OCR. OCR takes longer on large documents; progress is shown per page, and reading can be cancelled. Results show pages read, OCR pages, blank pages, and unread pages. Incomplete extraction is explicitly labelled for review. Recognition is intended for printed text; review the extracted text against your original, especially formulas, tables, or handwriting.

PDF image decoders for JPEG 2000, JBIG2, and CCITT scans are included with the website, together with PDF fonts and character maps. Failed image decoding is reported as unread content, rather than a blank page. Uncertain OCR text is excluded from factual cards. Scanned pages and uploaded images retain local JPEG previews for visual recall, including when OCR is disabled or fails. Previews have an approximate 8 MB budget per source. Covers and administrative instructions are excluded from automatic practice. Review extraction warnings against your original.

Existing sets and restored backups automatically regenerate their cards when generation changes, preserving progress on unchanged cards. Original PDFs are not stored, so older extractions need re-uploading only to obtain new page previews or improved extraction. Use **Add materials**: files with the same name replace their earlier extraction within that study set.

## Study tools

- **Quick quiz:** answer original multiple-choice questions, complete source sentences, or write a short answer. Source answers enable grading. Generated answers are labelled AI suggestions; quiz feedback says when your choice matches the suggestion.
- **Flashcards:** question cards hide alternatives on the front and reveal a concrete answer and explanation on the back. Missing answers offer local AI generation instead of a generic checklist. Facts and source images also support recall.
- **Match it:** connect concepts to definitions, topics to question excerpts, or source-page labels to images. A mismatch schedules another look.
- **Written recall:** explain a concept yourself, compare with the original source, then self-grade. Keyword overlap is a hint, not a grade.
- **Past-paper practice:** attempt complete questions with their alternatives. Compare with a source answer, a labelled AI suggestion and explanation, or related excerpts. These self-ratings are saved separately from card progress.
- **Focused review:** missed concepts and due cards come first. Two confident reviews make a concept “familiar”. Confident reviews are scheduled after 10 minutes, 1 day, 3 days, and 7 days; missed concepts return sooner.
- **Materials and ideas:** read extracted text, inspect source locations, search across your material, and remove individual files.
- **Backup and restore:** export materials and progress as JSON. Restore adds copies while keeping your existing sets.

## What this first version can and cannot do

This is a **local study tool with optional Ollama answers**. It creates up to 500 cards from questions, facts, lists, tables, and images. Numbered answer keys can supply answers from other pages of the same source. Alternatives are not promoted to facts. AI explanations persist in backups and survive regeneration when the question and choices are unchanged; a newly supplied source answer takes precedence.

Local AI can answer ordinary subject questions without separate notes. It uses reliable course text when available, or labels its answer as general knowledge. Supporting quotes are checked against the supplied text. Suggestions can still be wrong and are not a teacher's marking scheme. Essays remain self-assessed; unavailable figures or exact course-specific facts can leave questions unanswered. This answer feature processes text; difficult handwriting, formulas and diagrams remain visual practice. Legacy DOC/PPT files need conversion. Malformed, encrypted or unsupported files can fail explicitly. Text is bounded to 2 million characters, expanded Office archives to 100 MB, and OCR has page timeouts.

## Free local AI

Install [Ollama](https://ollama.com/download) and download a local model:

```sh
ollama pull qwen3.5:4b
npm run build
npm run ai
```

Keep Ollama and the Quizo server running. On Windows, after the model is installed, **Start-Quizo.cmd** builds the app, starts the local server in the background, and opens the GitHub Pages website. In the app choose **AI answers → Check connection → Create answers**, or **Create answer with AI** on an unanswered card. Answers are saved one at a time, so cancelling preserves completed answers. Model loading can make the first answer slower; CPU generation can take tens of seconds per question.

The default server is `http://127.0.0.1:3001/api` and binds only to this computer. It calls local Ollama on port 11434 and accepts Quizo's GitHub Pages origin and local browser origins. Cloud-tagged models are excluded. For local-only Ollama operation set `OLLAMA_NO_CLOUD=1` or `disable_ollama_cloud: true` in its configuration, as described in the [Ollama FAQ](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features).

Your browser may ask for permission to reach a service on this computer. Alternatively, open `http://127.0.0.1:3001/QuizoForStudents/`; localhost and GitHub Pages have separate study storage, so export/restore a backup when switching. GitHub Pages hosts the interface; each student's computer runs local AI. Other devices need their own installation. No API key, paid service, or account is required for this setup. Selected questions, alternatives and relevant text are processed by Ollama on this computer.

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
