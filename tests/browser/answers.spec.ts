import { test, expect, type Page } from '@playwright/test';

async function exam(page: Page) {
  await page.goto('./');
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('sv');
  await page.getByRole('button', { name: 'Prova ditt eget material' }).click();
  await page.getByRole('textbox', { name: 'Studiesamlingens namn' }).fill('Svar i kort');
  await page.getByLabel('Ladda upp studiefiler').setInputFiles({
    name: 'Tenta.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Fråga 1\nVilken enhet mäter kraft?\na Newton\nb Joule\nc Watt'),
  });
  await page.getByRole('button', { name: 'Skapa min studiesamling' }).click();
  await page.getByRole('button', { name: 'Börja studera' }).click();
  await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
  await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
  await expect(page.locator('.question-choices')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vänd kortet' }).click();
  await page.getByRole('button', { name: 'Skapa svar med AI' }).click();
}

test('a generated answer replaces the checklist in the current card, survives reload, and grades the original quiz options', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({ json: { provider: 'ollama', models: ['qwen3.5:4b'] } }),
  );
  await page.route('**/api/answer', (route) => {
    const body = route.request().postDataJSON();
    expect(body.language).toBe('sv');
    expect(body.choices).toEqual(['Newton', 'Joule', 'Watt']);
    expect(body.context.some((item: { text: string }) => /Joule|Watt/.test(item.text))).toBe(false);
    return route.fulfill({
      json: {
        status: 'ready',
        answer: 'Newton',
        explanation: 'Kraft mäts i newton. Joule mäter energi och watt mäter effekt.',
        basis: 'general',
        model: 'qwen3.5:4b',
      },
    });
  });
  await exam(page);
  await page.getByRole('button', { name: 'Kontrollera anslutningen' }).click();
  await page.getByRole('button', { name: 'Skapa svar', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('1 svar sparade');
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await expect(page.locator('.actual-answer')).toHaveText('Newton');
  await expect(page.locator('.answer-explanation')).toContainText('Joule mäter energi');
  await expect(page.locator('.question-panel')).toContainText('AI-förslag');
  await expect(page.locator('.study-checklist')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
  await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
  await page.getByRole('button', { name: 'Vänd kortet' }).click();
  await expect(page.locator('.actual-answer')).toHaveText('Newton');
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: 'Börja öva' }).click();
  await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
  await page.getByRole('button', { name: /Newton/ }).click();
  await expect(page.locator('.quiz-option.correct')).toHaveCount(1);
  await expect(page.locator('.answer-reveal')).toContainText('Joule mäter energi');
});

test('an unavailable model does not invent an answer or discard the uploaded question', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({ status: 503, json: { error: 'Ollama not running' } }),
  );
  await exam(page);
  await page.getByRole('button', { name: 'Kontrollera anslutningen' }).click();
  await expect(page.getByRole('alert')).toContainText('Starta Ollama');
  await expect(page.getByRole('button', { name: 'Skapa svar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await expect(page.locator('.answer-reveal')).toContainText(
    'Inget svar har lästs eller skapats ännu',
  );
  await expect(page.locator('.question-panel h2')).toContainText('Vilken enhet mäter kraft');
});
