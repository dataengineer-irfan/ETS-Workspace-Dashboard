import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:42005/login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByPlaceholder(/admin or employee/i).fill('admin');
  await page.getByPlaceholder(/account password/i).fill('Admin@2026!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.goto('http://localhost:42005/dashboard?tab=ai_utilization', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('[data-dashboard="ai-utilization"]', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Temp/ai-health-opp-fixed.png', fullPage: false });
  const health = await page.locator('.ai-health-tile').count();
  const tilesText = await page.locator('.ai-health-tile').allTextContents();
  const oppCards = await page.locator('.ai-opp-card').allTextContents();
  const funnel = await page.locator('.ai-funnel-step').allTextContents();
  const tileBox = await page.locator('.ai-health-tile').first().boundingBox();
  const oppBox = await page.locator('.ai-cmd-opp').boundingBox();
  console.log(JSON.stringify({ health, tilesText, oppCards, funnel, tileBox, oppBox }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
