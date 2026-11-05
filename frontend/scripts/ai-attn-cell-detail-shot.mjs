import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  if (!fs.existsSync('C:/Temp')) fs.mkdirSync('C:/Temp', { recursive: true });
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
  await page.waitForTimeout(1500);

  const projectBtn = page.getByRole('button', { name: 'Project', exact: true });
  await projectBtn.click();
  await page.waitForSelector('.ai-attn-heat', { timeout: 15000 });
  await page.waitForTimeout(500);

  const qaCell = page.getByRole('button', { name: /AK · QA gap: \d+/i }).first();
  await qaCell.click();
  await page.waitForSelector('.ai-attn-heat-pop', { timeout: 10000 });
  await page.waitForTimeout(400);

  const out = 'C:/Temp/ai-attn-cell-detail.png';
  await page.screenshot({ path: out, fullPage: false });
  const popText = await page.locator('.ai-attn-heat-pop').innerText();
  const hasStrip = await page.locator('.ai-attn-heat-detail').count();
  const lineCount = await page.locator('.ai-attn-heat-pop .ai-attn-line').count();
  console.log(JSON.stringify({ out, popText, hasStrip, lineCount }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
