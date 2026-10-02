import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function exam(page: Page, manual = false) {
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
  if (manual) await page.getByRole('button', { name: 'Skapa svar med AI' }).click();
}

test('upload automatically creates an answer, survives reload, and grades the original quiz options', async ({
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
  await exam(page, true);
  await page.getByRole('button', { name: 'Kontrollera anslutningen' }).click();
  await expect(page.getByRole('alert')).toContainText('Starta Ollama');
  await expect(page.getByRole('button', { name: 'Skapa svar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await expect(page.locator('.answer-reveal')).toContainText(
    'Inget svar har lästs eller skapats ännu',
  );
  await expect(page.locator('.question-panel h2')).toContainText('Vilken enhet mäter kraft');
});

test('a separate answer-key upload replaces an existing AI answer without another inference', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', (route) => {
    calls++;
    return route.fulfill({
      json: {
        status: 'ready',
        answer: 'Joule',
        explanation: 'Ett avsiktligt felaktigt AI-förslag i testet.',
        basis: 'general',
        model: 'qwen3.5:4b',
      },
    });
  });
  await exam(page);
  await expect(page.locator('.actual-answer')).toHaveText('Joule');
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: 'Lägg till material', exact: true }).click();
  await page.getByLabel('Ladda upp studiefiler').setInputFiles({
    name: 'Facit.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Facit\n1. a'),
  });
  await page.getByRole('button', { name: 'Skapa min studiesamling' }).click();
  await page.getByRole('button', { name: 'Börja studera' }).click();
  await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
  await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
  await page.getByRole('button', { name: 'Vänd kortet' }).click();
  await expect(page.locator('.actual-answer')).toHaveText('Newton');
  await expect(page.locator('.question-panel')).not.toContainText('AI-förslag');
  await page.getByText('Stödjande källutdrag', { exact: true }).click();
  await expect(page.locator('.answer-reveal')).toContainText('Facit.txt');
  expect(calls).toBe(1);
});

test('an unfinished automatic answer resumes after reload without a generation button', async ({
  page,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', async (route) => {
    calls++;
    if (calls === 1) await held;
    await route
      .fulfill({
        json: {
          status: 'ready',
          answer: 'Newton',
          explanation: 'Kraft mäts i newton.',
          basis: 'general',
          model: 'qwen3.5:4b',
        },
      })
      .catch(() => {});
  });
  try {
    await exam(page);
    await expect(page.locator('.answer-preparation')).toContainText('Förbereder svar automatiskt');
    await expect.poll(() => calls).toBe(1);
    await page.reload();
    await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
    await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
    await page.getByRole('button', { name: 'Vänd kortet' }).click();
    await expect(page.locator('.actual-answer')).toHaveText('Newton');
    expect(calls).toBe(2);
  } finally {
    release();
  }
});

test('automatic preparation continues through a study-set switch and an upload dialog cancellation', async ({
  page,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', async (route) => {
    calls++;
    if (calls === 1) await held;
    await route
      .fulfill({
        json: {
          status: 'ready',
          answer: 'Newton',
          explanation: 'Kraft mäts i newton.',
          basis: 'general',
          model: 'qwen3.5:4b',
        },
      })
      .catch(() => {});
  });
  try {
    await exam(page);
    await expect.poll(() => calls).toBe(1);
    await page.getByRole('button', { name: 'Avsluta övningen' }).click();
    await page.getByRole('button', { name: 'Lägg till material', exact: true }).click();
    await page.getByRole('button', { name: 'Stäng uppladdning' }).click();
    if (await page.locator('.mobile-menu-button').isVisible())
      await page.locator('.mobile-menu-button').click();
    await page.locator('.set-item').first().click();
    if (await page.locator('.mobile-menu-button').isVisible())
      await page.locator('.mobile-menu-button').click();
    await page.getByRole('button', { name: 'Svar i kort', exact: true }).click();
    await expect(page.locator('.answer-preparation')).toHaveCount(0);
    await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
    await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
    await page.getByRole('button', { name: 'Vänd kortet' }).click();
    await expect(page.locator('.actual-answer')).toHaveText('Newton');
    expect(calls).toBe(2);
  } finally {
    release();
  }
});

test('a conditional method is usable on a card but never grades an unknown multiple-choice answer', async ({
  page,
}) => {
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', (route) =>
    route.fulfill({
      json: {
        status: 'ready',
        answer: 'Identifiera den efterfrågade storheten och kontrollera dess SI-enhet.',
        explanation: 'En metod för att lösa uppgiften när viktiga uppgifter saknas.',
        answerType: 'approach',
        basis: 'general',
        model: 'qwen3.5:4b',
      },
    }),
  );
  await exam(page);
  await expect(page.locator('.actual-answer')).toContainText('SI-enhet');
  await expect(page.locator('.answer-label')).toContainText('Lösningsmetod');
  await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  await page.getByRole('button', { name: 'Börja öva' }).click();
  await page.getByRole('button', { name: 'Starta 1 frågor' }).click();
  await page.getByRole('button', { name: /Newton/ }).click();
  await expect(page.locator('.quiz-option.correct')).toHaveCount(0);
  await expect(page.locator('.quiz-option.incorrect')).toHaveCount(0);
  await expect(page.locator('.actual-answer')).toContainText('SI-enhet');
});
