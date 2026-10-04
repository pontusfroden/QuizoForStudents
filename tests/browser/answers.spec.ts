import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function exam(page: Page, manual = false) {
  await page.goto('./');
  await page.locator('.language-select').selectOption('sv');
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

test('answer length settings persist on close and are used by automatic preparation', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('sv');
  await page.getByRole('button', { name: 'AI-inställningar', exact: true }).click();
  await page.getByLabel('Svarslängd').selectOption('full');
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'AI-inställningar', exact: true }).click();
  await expect(page.getByLabel('Svarslängd')).toHaveValue('full');
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', (route) => {
    expect(route.request().postDataJSON().detail).toBe('full');
    return route.fulfill({
      json: {
        status: 'ready',
        answer: 'Newton',
        explanation: 'Kraft mäts i newton.',
        basis: 'general',
        model: 'qwen3.5:4b',
      },
    });
  });
  await exam(page);
  await expect(page.locator('.actual-answer')).toHaveText('Newton');
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

test('skipped book questions survive reload, stay out of every mode, and return when book text is uploaded', async ({
  page,
}) => {
  let bookCalls = 0;
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', (route) => {
    const body = route.request().postDataJSON();
    if (!body.prompt.includes('kursboken'))
      return route.fulfill({
        json: {
          status: 'ready',
          answer: 'Newton',
          explanation: 'Kraft mäts i newton.',
          basis: 'general',
          answerType: 'solution',
          model: 'qwen3.5:4b',
        },
      });
    bookCalls++;
    const context = body.context.find((item: { text: string }) =>
      item.text.includes('finansiering'),
    );
    return route.fulfill({
      json: {
        status: 'ready',
        answer: context
          ? 'Otillräcklig finansiering, oklart ansvar och utebliven uppföljning.'
          : 'Kursbokens kapitel saknas.',
        explanation: context
          ? 'De tre skälen anges i det uppladdade utdraget.'
          : 'Det behövs ett utdrag ur det efterfrågade kapitlet.',
        basis: context ? 'material' : 'general',
        answerType: context ? 'solution' : 'unavailable',
        model: 'qwen3.5:4b',
        ...(context
          ? {
              reference: {
                sourceId: context.sourceId,
                location: context.location,
                quote: context.text,
              },
            }
          : {}),
      },
    });
  });
  await page.goto('./');
  await page.locator('.language-select').selectOption('sv');
  await page.getByRole('button', { name: 'Prova ditt eget material' }).click();
  await page.getByRole('textbox', { name: 'Studiesamlingens namn' }).fill('Bok och fakta');
  await page.getByLabel('Ladda upp studiefiler').setInputFiles({
    name: 'Tenta.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Fråga 1\nVilka tre skäl anges i kapitel 7 av kursboken för att reformen misslyckades?\nFråga 2\nVilken enhet mäter kraft?\na Newton\nb Joule\nc Watt',
    ),
  });
  await page.getByRole('button', { name: 'Skapa min studiesamling' }).click();
  await page.getByRole('button', { name: 'Börja studera' }).click();
  await expect(page.locator('.answer-preparation')).toHaveCount(0);
  await expect(page.locator('.skipped-questions summary')).toContainText('1 fråga');
  await page.reload();
  await expect(page.locator('.skipped-questions')).toBeVisible();
  expect(bookCalls).toBe(1);
  for (const [mode, count] of [
    [/Vänd. Tänk. Kom ihåg./, 'Starta 1 frågor'],
    [/Testa dina kunskaper./, 'Starta 1 frågor'],
    [/Hitta sambanden./, 'Starta 1 par'],
    [/Förklara med egna ord./, 'Starta 1 frågor'],
    [/Förbered dig för nästa tenta./, 'Starta 1 frågor'],
  ] as const) {
    await page.getByRole('button', { name: 'Alla studielägen', exact: true }).click();
    await page.getByRole('button', { name: mode }).click();
    await page.getByRole('button', { name: count }).click();
    if (count.includes('par'))
      await expect(page.locator('.match-grid')).not.toContainText('kursboken');
    else await expect(page.locator('.question-panel h2')).toContainText('kraft');
    await page.getByRole('button', { name: 'Avsluta övningen' }).click();
  }
  await page.getByRole('button', { name: 'Lägg till material', exact: true }).click();
  await page.getByLabel('Ladda upp studiefiler').setInputFiles({
    name: 'Kursbok.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'I kapitel 7 anges tre skäl till att reformen misslyckades: otillräcklig finansiering, oklart ansvar och utebliven uppföljning.',
    ),
  });
  await page.getByRole('button', { name: 'Skapa min studiesamling' }).click();
  await page.getByRole('button', { name: 'Börja studera' }).click();
  await expect(page.locator('.answer-preparation')).toHaveCount(0);
  await expect(page.locator('.skipped-questions')).toHaveCount(0);
  expect(bookCalls).toBe(2);
  await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
  await expect(page.locator('.session-intro .button.primary')).toBeEnabled();
  await expect(page.locator('.session-intro .button.primary')).not.toHaveText(/Starta 1 frågor/);
});

test('a late unavailable answer is skipped without grading or retry loops', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route('**/api/status', (route) => route.fulfill({ json: { models: ['qwen3.5:4b'] } }));
  await page.route('**/api/answer', async (route) => {
    calls++;
    await held;
    await route.fulfill({
      json: {
        status: 'ready',
        answer: 'Underlag saknas.',
        explanation: 'Den efterfrågade källan har inte laddats upp.',
        basis: 'general',
        answerType: 'unavailable',
        model: 'qwen3.5:4b',
      },
    });
  });
  try {
    await exam(page);
    release();
    await page.getByRole('button', { name: 'Hoppa över frågan', exact: true }).click();
    await expect(page.locator('.completion-score')).toContainText('—');
    await page.reload();
    await expect(page.locator('.set-progress-label')).toContainText('0 av 0');
    await page.getByRole('button', { name: /Vänd. Tänk. Kom ihåg./ }).click();
    await expect(page.getByRole('button', { name: 'Starta 0 frågor' })).toBeDisabled();
    expect(calls).toBe(1);
  } finally {
    release();
  }
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
    await expect(page.locator('.answer-reveal')).toContainText('Svaret skapas automatiskt');
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
