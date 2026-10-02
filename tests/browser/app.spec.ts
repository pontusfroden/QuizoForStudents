import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { pdfFixture } from './pdf-fixture';

test('sample set, all modes, progress and persistent answers', async ({ page },testInfo) => {
  const errors: string[] = []; page.on('pageerror',error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading',{ name:'Good things take a little practice.' })).toBeVisible();
  await page.screenshot({ path:`test-results/overview-${testInfo.project.name}.png`,fullPage:true });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',await page.locator('body').evaluate(body => body.clientWidth));
  await page.getByRole('button',{name:'Let’s get learning'}).click();
  await page.getByRole('combobox').selectOption('5');
  await page.getByRole('button',{name:'Start 5 questions'}).click();
  for (let index=0;index<5;index++) {
    await page.locator('.quiz-option').first().click();
    await expect(page.locator('.answer-reveal')).toBeVisible();
    await expect(page.locator('.source-detail')).toContainText(/Page|Slide/);
    await page.getByRole('button',{ name:index === 4 ? 'See results' : 'Next question' }).click();
  }
  await expect(page.locator('.completion-score')).toBeVisible();
  await page.getByRole('button',{name:'Back to overview'}).click();
  await expect(page.locator('.set-progress-label')).toContainText('5 of');
  await page.reload();
  await expect(page.locator('.set-progress-label')).toContainText('5 of');
  await page.getByRole('button',{name:/Flip. Think. Remember./}).click();
  await page.getByRole('combobox').selectOption('5');
  await page.getByRole('button',{name:'Start 5 questions'}).click();
  await page.getByRole('button',{name:'Flip card'}).click();
  await expect(page.locator('.answer-reveal')).toBeVisible();
  await page.getByRole('button',{name:'Got it',exact:true}).click();
  await page.getByRole('button',{name:'End session'}).click();
  await page.getByRole('button',{name:/Connect the dots./}).click();
  await page.getByRole('button',{name:'Start 5 pairs'}).click();
  await expect(page.locator('.match-tile')).toHaveCount(10);
  await page.getByRole('button',{name:'End session'}).click();
  await page.getByRole('button',{name:/Say it your way./}).click();
  await page.getByRole('button',{name:'Start 10 questions'}).click();
  await page.getByRole('textbox',{name:'Your written answer'}).fill('The concept describes an important biological process.');
  await page.getByRole('button',{name:'Compare with notes'}).click();
  await expect(page.locator('.answer-reveal')).toContainText('not an automatic grade');
  await page.getByRole('button',{name:'End session'}).click();
  await page.getByRole('button',{name:'All study modes'}).click();
  await page.getByRole('button',{name:/Meet your next exam./}).click();
  await page.getByRole('button',{name:'Start 3 questions'}).click();
  await page.getByRole('textbox',{name:'Your written answer'}).fill('The cell membrane is selectively permeable.');
  await page.getByRole('button',{name:'Compare with notes'}).click();
  await expect(page.locator('.answer-reveal')).toContainText('not a verified marking guide');
  expect(errors).toEqual([]);
});

test('real PDF, TXT, DOCX, PPTX upload, search, source deletion and backup round-trip', async ({ page }) => {
  await page.goto('./');
  if (await page.getByRole('button',{name:'Open navigation'}).isVisible()) await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('button',{name:'New study set',exact:true}).click();
  await page.getByRole('textbox',{name:'Study set name'}).fill('My chemistry test');
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml','<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><a:p><a:r><a:t>Evaporation is the process by which liquid changes into a gas at its surface.</a:t></a:r></a:p></p:cSld></p:sld>');
  const docx = new JSZip();
  docx.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  docx.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  docx.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Condensation is the process by which a gas changes into a liquid as it cools.</w:t></w:r></w:p></w:body></w:document>');
  await page.getByLabel('Upload study files').setInputFiles([
    {name:'Chemistry notes.txt',mimeType:'text/plain',buffer:Buffer.from('An atom is the smallest unit of an element that retains its chemical properties.\nA molecule is a group of atoms bonded together to form a chemical unit.\nA catalyst is a substance that increases the rate of a chemical reaction without being consumed.')},
    {name:'Chemistry test.txt',mimeType:'text/plain',buffer:Buffer.from('1. Explain how a catalyst changes the rate of a chemical reaction.')},
    {name:'Lecture.pptx',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',buffer:await zip.generateAsync({type:'nodebuffer'})},
    {name:'Handout.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await docx.generateAsync({type:'nodebuffer'})},
    {name:'Physics.pdf',mimeType:'application/pdf',buffer:pdfFixture()},
  ]);
  await expect(page.getByRole('combobox',{name:'Type for Chemistry test.txt'})).toHaveValue('exam');
  await page.getByRole('button',{name:'Build my study set'}).click();
  await expect(page.getByRole('heading',{name:'Your materials are ready.'})).toBeVisible();
  await page.getByRole('button',{name:'Let’s study'}).click();
  await expect(page.getByRole('heading',{name:'My chemistry test',exact:true})).toBeVisible();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 7');
  await page.getByRole('textbox',{name:'Search your materials'}).fill('evaporation');
  await expect(page.locator('.material-row')).toHaveCount(1);
  await expect(page.locator('.idea-card')).toContainText('Evaporation');
  await page.getByRole('textbox',{name:'Search your materials'}).fill('');
  await page.getByRole('button',{name:'Read text'}).first().click();
  await expect(page.locator('.extracted-text')).toContainText('smallest unit');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  const download = await downloadPromise; const backupPath = await download.path();
  await page.getByLabel('Restore Quizo backup').setInputFiles(backupPath!);
  await expect(page.getByRole('heading',{name:'My chemistry test (restored)',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Search your materials'}).fill('Lecture.pptx');
  await page.getByRole('button',{name:'Delete Lecture.pptx'}).click();
  await page.getByRole('button',{name:'Remove material',exact:true}).click();
  await expect(page.locator('.material-row')).toHaveCount(0);
  await page.getByRole('textbox',{name:'Search your materials'}).fill('');
  await expect(page.locator('.material-row')).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole('heading',{name:'My chemistry test (restored)',exact:true})).toBeVisible();
});

test('invalid uploads give actionable errors and pasted notes work', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button',{name:'Try your own notes'}).click();
  await page.getByRole('textbox',{name:'Study set name'}).fill('Pasted study set');
  await page.getByLabel('Upload study files').setInputFiles({name:'scan.png',mimeType:'image/png',buffer:Buffer.from('image')});
  await page.getByRole('button',{name:'Build my study set'}).click();
  await expect(page.getByRole('alert')).toContainText('use PDF, DOCX, PPTX');
  await page.getByRole('button',{name:'Remove scan.png'}).click();
  await page.getByText('Or paste your notes instead').click();
  await page.getByRole('textbox',{name:'Paste study notes'}).fill('Gravity is the force of attraction between objects that have mass.\nFriction is a force that opposes the relative motion of surfaces in contact.');
  await page.getByRole('button',{name:'Build my study set'}).click();
  await page.getByRole('button',{name:'Let’s study'}).click();
  await expect(page.locator('.set-progress-label')).toContainText('0 of 2');
});

test('an image-only PDF reports missing text instead of inventing content', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button',{name:'Try your own notes'}).click();
  await page.getByRole('textbox',{name:'Study set name'}).fill('Scanned material');
  await page.getByLabel('Upload study files').setInputFiles({name:'Scanned notes.pdf',mimeType:'application/pdf',buffer:pdfFixture(true)});
  await page.getByRole('button',{name:'Build my study set'}).click();
  await expect(page.getByRole('alert')).toContainText('no usable text found');
  await expect(page.getByRole('button',{name:'Let’s study'})).toHaveCount(0);
});
