export async function renderURL(url: string): Promise<string> {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error(
      'playwright is required for --render. Install it with: npm install playwright'
    );
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    return html;
  } finally {
    await browser.close();
  }
}
