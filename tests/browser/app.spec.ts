import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { mixedPdfFixture, pdfFixture } from './pdf-fixture';

test('sample set, all modes, progress and persistent answers', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Good things take a little practice.' }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((body) => body.clientWidth),
  );
  await page.getByRole('button', { name: 'Let’s get learning' }).click();
  await page.getByRole('combobox', { name: 'Session length' }).selectOption('5');
  await page.getByRole('button', { name: 'Start 5 questions' }).click();
  for (let index = 0; index < 5; index++) {
    await page.locator('.quiz-option').first().click();
    await expect(page.locator('.answer-reveal')).toBeVisible();
    await expect(page.locator('.source-detail')).toContainText(/Page|Slide/);
    await page.getByRole('button', { name: index === 4 ? 'See results' : 'Next question' }).click();
  }
  await expect(page.locator('.completion-score')).toBeVisible();
  await page.getByRole('button', { name: 'Back to overview' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('5 of');
  await page.reload();
  await expect(page.locator('.set-progress-label')).toContainText('5 of');
  await page.getByRole('button', { name: /Flip. Think. Remember./ }).click();
  await page.getByRole('combobox', { name: 'Session length' }).selectOption('5');
  await page.getByRole('button', { name: 'Start 5 questions' }).click();
  await page.getByRole('button', { name: 'Flip card' }).click();
  await expect(page.locator('.answer-reveal')).toBeVisible();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: /Connect the dots./ }).click();
  await page.getByRole('button', { name: 'Start 5 pairs' }).click();
  await expect(page.locator('.match-tile')).toHaveCount(10);
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: /Say it your way./ }).click();
  await page.getByRole('button', { name: 'Start 10 questions' }).click();
  await page
    .getByRole('textbox', { name: 'Your written answer' })
    .fill('The concept describes an important biological process.');
  await page.getByRole('button', { name: 'Compare with notes' }).click();
  await expect(page.locator('.answer-reveal')).toContainText('not an automatic grade');
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'All study modes' }).click();
  await page.getByRole('button', { name: /Meet your next exam./ }).click();
  await page.getByRole('button', { name: 'Start 3 questions' }).click();
  await page
    .getByRole('textbox', { name: 'Your written answer' })
    .fill('The cell membrane is selectively permeable.');
  await page.getByRole('button', { name: 'Compare with notes' }).click();
  await expect(page.locator('.answer-reveal')).toContainText('not a verified marking guide');
  expect(errors).toEqual([]);
});

test('real PDF, TXT, DOCX, PPTX upload, search, source deletion and backup round-trip', async ({
  page,
}) => {
  await page.goto('./');
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible())
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'New study set', exact: true }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('My chemistry test');
  const zip = new JSZip();
  zip.file(
    'ppt/slides/slide1.xml',
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><a:p><a:r><a:t>Evaporation is the process by which liquid changes into a gas at its surface.</a:t></a:r></a:p></p:cSld></p:sld>',
  );
  const docx = new JSZip();
  docx.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  docx.file(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  docx.file(
    'word/document.xml',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Condensation is the process by which a gas changes into a liquid as it cools.</w:t></w:r></w:p></w:body></w:document>',
  );
  await page.getByLabel('Upload study files').setInputFiles([
    {
      name: 'Chemistry notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'An atom is the smallest unit of an element that retains its chemical properties.\nA molecule is a group of atoms bonded together to form a chemical unit.\nA catalyst is a substance that increases the rate of a chemical reaction without being consumed.',
      ),
    },
    {
      name: 'Chemistry test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('1. Explain how a catalyst changes the rate of a chemical reaction.'),
    },
    {
      name: 'Lecture.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    },
    {
      name: 'Handout.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await docx.generateAsync({ type: 'nodebuffer' }),
    },
    { name: 'Physics.pdf', mimeType: 'application/pdf', buffer: pdfFixture() },
  ]);
  await expect(page.getByRole('combobox', { name: 'Type for Chemistry test.txt' })).toHaveValue(
    'exam',
  );
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await expect(page.getByRole('heading', { name: 'Your materials are ready.' })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await expect(page.getByRole('heading', { name: 'My chemistry test', exact: true })).toBeVisible();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 7');
  await page.getByRole('textbox', { name: 'Search your materials' }).fill('evaporation');
  await expect(page.locator('.material-row')).toHaveCount(1);
  await expect(page.locator('.idea-card')).toContainText('Evaporation');
  await page.getByRole('textbox', { name: 'Search your materials' }).fill('');
  await page.getByRole('button', { name: 'Read text' }).first().click();
  await expect(page.locator('.extracted-text')).toContainText('smallest unit');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  await page.getByLabel('Restore Quizo backup').setInputFiles(backupPath!);
  await expect(
    page.getByRole('heading', { name: 'My chemistry test (restored)', exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Search your materials' }).fill('Lecture.pptx');
  await page.getByRole('button', { name: 'Delete Lecture.pptx' }).click();
  await page.getByRole('button', { name: 'Remove material', exact: true }).click();
  await expect(page.locator('.material-row')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search your materials' }).fill('');
  await expect(page.locator('.material-row')).toHaveCount(4);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'My chemistry test (restored)', exact: true }),
  ).toBeVisible();
});

test('invalid uploads give actionable errors and pasted notes work', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Pasted study set');
  await page
    .getByLabel('Upload study files')
    .setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: Buffer.from('image') });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await expect(page.getByRole('alert')).toContainText('use PDF, DOCX, PPTX');
  await page.getByRole('button', { name: 'Remove scan.png' }).click();
  await page.getByText('Or paste your notes instead').click();
  await page
    .getByRole('textbox', { name: 'Paste study notes' })
    .fill(
      'Gravity is the force of attraction between objects that have mass.\nFriction is a force that opposes the relative motion of surfaces in contact.',
    );
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 2');
});

test('an image-only PDF reports missing text instead of inventing content', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Scanned material');
  await page.getByLabel('Upload study files').setInputFiles({
    name: 'Scanned notes.pdf',
    mimeType: 'application/pdf',
    buffer: pdfFixture(true),
  });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await expect(page.getByRole('alert')).toContainText(/no usable text found/i);
  await expect(page.getByRole('button', { name: 'Let’s study' })).toHaveCount(0);
});

async function scanFixture(page: import('@playwright/test').Page): Promise<Buffer> {
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1200, 1600);
    ctx.fillStyle = '#111';
    ctx.font = '32px Arial';
    const lines = [
      'Fotosyntes är den process som omvandlar',
      'ljusenergi till kemisk energi i växter.',
      '',
      'Cellmembranet är en selektiv barriär som',
      'reglerar vilka ämnen som passerar cellen.',
      '',
      '1. Förklara hur fotosyntes lagrar energi.',
    ];
    lines.forEach((line, index) => ctx.fillText(line, 90, 130 + index * 65));
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  });
  return Buffer.from(jpeg, 'base64');
}
test('Swedish interface and real OCR on a mixed PDF preserve source pages and create Swedish quizzes', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const languageRequests: string[] = [];
  page.context().on('request', (request) => {
    if (request.url().includes('.traineddata.gz')) languageRequests.push(request.url());
  });
  await page.goto('./');
  const scan = await scanFixture(page);
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('sv');
  await expect(page.getByRole('heading', { name: 'Lite övning gör stor skillnad.' })).toBeVisible();
  await page.getByRole('button', { name: 'Prova ditt eget material' }).click();
  await page.getByRole('textbox', { name: 'Studiesamlingens namn' }).fill('Biologi på svenska');
  await expect(page.getByRole('combobox', { name: 'Dokumentets språk' })).toHaveValue('swe+eng');
  await page.getByLabel('Ladda upp studiefiler').setInputFiles({
    name: 'Biologi.pdf',
    mimeType: 'application/pdf',
    buffer: mixedPdfFixture(scan, 1200, 1600),
  });
  await page.getByRole('button', { name: 'Skapa min studiesamling' }).click();
  await expect(page.getByRole('heading', { name: 'Ditt material är klart.' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('.result-file')).toContainText('2 av 3 sidor lästa');
  await expect(page.locator('.result-file')).toContainText('1 sida läst med OCR');
  expect(languageRequests.some((url) => url.endsWith('/swe.traineddata.gz'))).toBe(true);
  expect(
    languageRequests.every((url) => url.startsWith('http://127.0.0.1:4173/QuizoForStudents/ocr/')),
  ).toBe(true);
  await page.getByText('Visa anmärkningar').click();
  await expect(page.locator('.extraction-notes')).toContainText('Tom sida 3 hoppades över');
  await page.screenshot({
    path: `test-results/swedish-ocr-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Börja studera' }).click();
  await page.getByRole('textbox', { name: 'Sök i ditt material' }).fill('fotosyntes');
  await page.getByRole('button', { name: 'Läs texten' }).click();
  await expect(page.locator('.extracted-text')).toContainText('Sida 2');
  await expect(page.locator('.extracted-text')).toContainText(
    'ljusenergi till kemisk energi i växter',
  );
  await expect(page.locator('.idea-card').filter({ hasText: 'Fotosyntes' })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lite övning gör stor skillnad.' })).toBeVisible();
  await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
  await page.getByRole('button', { name: 'Starta 3 frågor' }).click();
  await expect(page.locator('.question-panel')).toContainText('Vad kommer du ihåg om');
  await page.getByRole('button', { name: 'Vänd kortet' }).click();
  await expect(page.locator('.answer-reveal')).toContainText('Jämför med källan');
  await page.getByRole('combobox', { name: 'Gränssnittets språk' }).selectOption('en');
  await expect(page.getByRole('button', { name: 'Got it', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('partial extraction is labelled incomplete and reading can be cancelled', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  const scan = await scanFixture(page);
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Partial PDF');
  await page.getByRole('combobox', { name: 'Scanned PDF pages' }).selectOption('off');
  await page.getByLabel('Upload study files').setInputFiles({
    name: 'Mixed.pdf',
    mimeType: 'application/pdf',
    buffer: mixedPdfFixture(scan, 1200, 1600),
  });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await expect(page.getByRole('heading', { name: 'Some materials need a review.' })).toBeVisible();
  await expect(page.locator('.result-file')).toContainText('1 of 3 pages read');
  await page.getByText('Show extraction notes').click();
  await expect(page.locator('.extraction-notes')).toContainText('Enable scanned-page reading');
  await page.getByRole('button', { name: 'Back to files' }).click();
  await page.getByRole('combobox', { name: 'Scanned PDF pages' }).selectOption('auto');
  await page.route('**/ocr/*.traineddata.gz', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await route.abort().catch(() => {});
  });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Cancel reading' }).click();
  await expect(page.getByRole('alert')).toContainText('Reading cancelled');
  await expect(page.getByRole('button', { name: 'Build my study set' })).toBeEnabled();
});

test('re-uploading a source replaces it while keeping progress for unchanged cards', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Re-upload test');
  const original =
    'Gravity is the force of attraction between objects that have mass.\nFriction is a force that opposes the relative motion of surfaces in contact.';
  await page
    .getByLabel('Upload study files')
    .setInputFiles({ name: 'Physics.txt', mimeType: 'text/plain', buffer: Buffer.from(original) });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await page.getByRole('button', { name: 'Let’s get learning' }).click();
  await page.getByRole('button', { name: 'Start 2 questions' }).click();
  await page.locator('.quiz-option').first().click();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Add materials' }).click();
  await page.getByLabel('Upload study files').setInputFiles({
    name: 'Physics.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      original + '\nEnergy is the capacity of a system to do work or transfer heat.',
    ),
  });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('1 of 3 concepts explored');
  await page.getByRole('textbox', { name: 'Search your materials' }).fill('Physics.txt');
  await expect(page.locator('.material-row')).toHaveCount(1);
});
