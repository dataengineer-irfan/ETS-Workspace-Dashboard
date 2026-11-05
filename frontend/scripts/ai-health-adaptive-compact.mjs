import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  if (!fs.existsSync('C:/Temp')) fs.mkdirSync('C:/Temp', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:42005/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByPlaceholder(/admin or employee/i).fill('admin');
  await page.getByPlaceholder(/account password/i).fill('Admin@2026!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.goto('http://127.0.0.1:42005/dashboard?tab=ai_utilization', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-dashboard="ai-utilization"] .ai-health-grid', { timeout: 45000 });
  // Wait until compact path is live (HMR after HEALTH_COMPACT_AT=1)
  await page.waitForFunction(() => {
    const grid = document.querySelector('[data-dashboard="ai-utilization"] .ai-health-grid');
    return grid?.getAttribute('data-health-density') === 'compact' && grid.querySelectorAll('.ai-health-row').length >= 3;
  }, { timeout: 30000 });
  await page.waitForTimeout(800);
  const panel = page.locator('[data-dashboard="ai-utilization"] .ai-cmd-mid > section').first();
  await panel.screenshot({ path: 'C:/Temp/ai-health-adaptive-compact.png' });
  const m = await page.evaluate(() => {
    const root = document.querySelector('[data-dashboard="ai-utilization"]');
    const grid = root?.querySelector('.ai-health-grid');
    return {
      density: grid?.getAttribute('data-health-density'),
      compactClass: grid?.classList.contains('is-compact') ?? false,
      tileCount: root?.querySelectorAll('.ai-health-tile').length ?? 0,
      rowCount: root?.querySelectorAll('.ai-health-row').length ?? 0,
      rows: [...(root?.querySelectorAll('.ai-health-row') || [])].map((el) => el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 140)),
      midOk: !!grid && !!root?.querySelector('.ai-attn-list'),
      oppOk: !!root?.querySelector('.ai-cmd-opp'),
      leagueOk: !!root?.querySelector('.ai-cmd-league'),
    };
  });
  console.log('COMPACT', JSON.stringify(m, null, 2));
  await browser.close();
  if (m.density !== 'compact' || m.rowCount < 3 || m.tileCount !== 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
