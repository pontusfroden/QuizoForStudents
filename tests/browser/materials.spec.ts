import { expect, test } from './fixtures';
import JSZip from 'jszip';

test('an exam alone runs every mode, retains multiple choice options, and persists progress', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('sv');
  await page.getByRole('button', { name: 'Prova ditt eget material' }).click();
  await page.getByRole('textbox', { name: 'Studiesamlingens namn' }).fill('Enbart tenta');
  await page.getByLabel('Ladda upp studiefiler').setInputFiles({
    name: 'Fysik tenta.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Fråga 1\nVilken enhet mäter kraft?\na Newton\nb Joule\nc Watt\nFråga 2\nRörelseenergi beror på:\na Massan och hastigheten\nb Enbart färgen\nc Enbart temperaturen\nFråga 3\nFörklara varför en kraft kan förändra ett föremåls rörelse.',
    ),
  });
  await page.getByRole('button', { name: 'Skapa min studiesamling' }).click();
  await page.getByRole('button', { name: 'Börja studera' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('0 av 3');
  await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
  await page.getByRole('button', { name: 'Starta 3 frågor' }).click();
  await expect(page.locator('.question-panel h2')).toContainText(/kraft|Rörelseenergi|Förklara/);
  await page.getByRole('button', { name: 'Vänd kortet' }).click();
  await expect(page.locator('.answer-reveal')).toContainText(
    'Inget svar har lästs eller skapats ännu',
  );
  await page.screenshot({
    path: `test-results/exam-flashcards-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Jag kan det', exact: true }).click();
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: 'Börja öva' }).click();
  await page.getByRole('button', { name: 'Starta 3 frågor' }).click();
  if (await page.locator('.quiz-option').count()) {
    await expect(page.locator('.quiz-option')).toHaveCount(3);
    await page.locator('.quiz-option').first().click();
    await expect(page.locator('.quiz-option.correct')).toHaveCount(0);
  } else {
    await page.getByRole('textbox', { name: 'Ditt quizsvar' }).fill('En kraft kan ändra rörelsen.');
    await page.getByRole('button', { name: 'Visa studiestöd' }).click();
  }
  await expect(page.getByRole('button', { name: 'Jag kan det', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: /Hitta sambanden./ }).click();
  await page.getByRole('button', { name: 'Starta 3 par' }).click();
  await expect(page.locator('.match-tile')).toHaveCount(6);
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: /Förklara med egna ord./ }).click();
  await page.getByRole('button', { name: 'Starta 3 frågor' }).click();
  await page
    .getByRole('textbox', { name: 'Ditt skriftliga svar' })
    .fill('Jag kan beskriva processen med ett exempel.');
  await page.getByRole('button', { name: 'Jämför med materialet' }).click();
  await expect(page.locator('.answer-reveal')).toBeVisible();
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: 'Alla studielägen' }).click();
  await page.getByRole('button', { name: /Förbered dig för nästa tenta./ }).click();
  await page.getByRole('button', { name: 'Starta 3 frågor' }).click();
  await expect(page.locator('.question-choices li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.reload();
  await expect(page.locator('.set-progress-label')).toContainText('1 av 3');
});

test('a source answer enables automatic grading without external notes', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Exam with answers');
  await page.getByLabel('Upload study files').setInputFiles({
    name: 'Exam.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Question 1\nWhich unit measures force?\na Newton\nb Joule\nc Watt\nAnswer: a',
    ),
  });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await page.getByRole('button', { name: 'Let’s get learning' }).click();
  await page.getByRole('button', { name: 'Start 1 questions' }).click();
  await page.getByRole('button', { name: /Newton/ }).click();
  await expect(page.locator('.answer-reveal')).toContainText('That’s it!');
  await expect(page.locator('.quiz-option.correct')).toHaveCount(1);
});

test('images and image-only slides work as visual flashcards even without OCR', async ({
  page,
}) => {
  await page.goto('./');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 800, 600);
    context.strokeStyle = '#7258cf';
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(100, 100);
    context.lineTo(600, 450);
    context.lineTo(700, 100);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const zip = new JSZip();
  zip.file(
    'ppt/slides/slide1.xml',
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
  );
  zip.file('ppt/media/image1.png', Buffer.from(png, 'base64'));
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Visual material');
  await page.getByRole('combobox', { name: 'Scanned PDF pages' }).selectOption('off');
  await page.getByLabel('Upload study files').setInputFiles([
    { name: 'Diagram.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') },
    {
      name: 'Image lecture.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    },
  ]);
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Study extracted pages' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 2');
  await page.getByRole('button', { name: /Flip. Think. Remember./ }).click();
  await page.getByRole('button', { name: 'Start 2 questions' }).click();
  await expect(page.locator('.visual-recall .source-image')).toBeVisible();
  await page.getByRole('button', { name: 'Hide image and recall' }).click();
  await expect(page.locator('.visual-recall .source-image')).toHaveCount(0);
  await page.getByRole('button', { name: 'Flip card' }).click();
  await expect(page.locator('.answer-reveal .source-image')).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'All study modes' }).click();
  await page.getByRole('button', { name: /Meet your next exam./ }).click();
  await page.getByRole('button', { name: 'Start 2 questions' }).click();
  await expect(page.locator('.visual-recall .source-image')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Your written answer' })
    .fill('The lines form a triangle.');
  await page.getByRole('button', { name: 'Compare with notes' }).click();
  await expect(page.locator('.answer-reveal .source-image')).toBeVisible();
  await page.reload();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 2');
});

test('PPTX speaker notes follow slide relationships even when note numbers differ', async ({
  page,
}) => {
  const zip = new JSZip();
  zip.file(
    'ppt/slides/slide1.xml',
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
  );
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide7.xml"/></Relationships>',
  );
  zip.file(
    'ppt/notesSlides/notesSlide7.xml',
    '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>Acceleration: change in velocity per unit time</a:t></a:r></a:p></p:notes>',
  );
  await page.goto('./');
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Speaker notes');
  await page.getByLabel('Upload study files').setInputFiles({
    name: 'Lecture.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 1');
  await page.getByRole('button', { name: /Flip. Think. Remember./ }).click();
  await page.getByRole('button', { name: 'Start 1 questions' }).click();
  await page.getByRole('button', { name: 'Flip card' }).click();
  await expect(page.locator('.answer-reveal')).toContainText('change in velocity');
});

test('tables, HTML, ODT, JSON and XLSX become cards without complete lecture prose', async ({
  page,
}) => {
  await page.goto('./');
  const odt = new JSZip();
  odt.file(
    'content.xml',
    '<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><text:p>Gravity: attraction between masses</text:p></office:document>',
  );
  const xlsx = new JSZip();
  xlsx.file(
    'xl/worksheets/sheet1.xml',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c t="inlineStr"><is><t>Velocity</t></is></c><c t="inlineStr"><is><t>Distance travelled per unit time</t></is></c></row></sheetData></worksheet>',
  );
  await page.getByRole('button', { name: 'Try your own notes' }).click();
  await page.getByRole('textbox', { name: 'Study set name' }).fill('Many formats');
  await page.getByLabel('Upload study files').setInputFiles([
    {
      name: 'Vocabulary.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Osmosis,Movement of water across a membrane'),
    },
    {
      name: 'Vocabulary.tsv',
      mimeType: 'text/tab-separated-values',
      buffer: Buffer.from('Pressure\tForce per unit area'),
    },
    {
      name: 'Article.html',
      mimeType: 'text/html',
      buffer: Buffer.from(
        '<script>throw Error("must not run")</script><h1>Energy</h1><p>Energy is the capacity to do work.</p>',
      ),
    },
    {
      name: 'Terms.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"Density":"Mass per unit volume"}'),
    },
    {
      name: 'Lecture.odt',
      mimeType: 'application/vnd.oasis.opendocument.text',
      buffer: await odt.generateAsync({ type: 'nodebuffer' }),
    },
    {
      name: 'Terms.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await xlsx.generateAsync({ type: 'nodebuffer' }),
    },
  ]);
  await page.getByRole('button', { name: 'Build my study set' }).click();
  await expect(page.locator('.result-file')).toHaveCount(6);
  await page.getByRole('button', { name: 'Let’s study' }).click();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 6');
  await page.getByRole('button', { name: /Flip. Think. Remember./ }).click();
  await expect(page.getByRole('button', { name: 'Start 6 questions' })).toBeEnabled();
});
