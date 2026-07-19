const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/dashboard.png', fullPage: true });

  await page.getByRole('button', { name: 'Новый анализ' }).first().click();
  await page.waitForURL('**/analysis');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/analysis.png', fullPage: true });

  await page.getByRole('button', { name: 'Запустить анализ' }).click();
  await page.waitForURL('**/analysis/result');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'artifacts/result.png', fullPage: true });

  await page.getByRole('button', { name: 'Сохранить ставку' }).click();
  await page.getByRole('link', { name: 'Журнал ставок' }).click();
  await page.waitForURL('**/bets');
  const savedBetVisible = await page.getByText('Vici +20.5 убийств').first().isVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/analysis/result', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/result-mobile.png', fullPage: true });

  process.stdout.write(JSON.stringify({ errors, savedBetVisible, url: page.url() }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
