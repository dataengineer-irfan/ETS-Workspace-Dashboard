import { chromium } from 'playwright';
import fs from 'fs';

async function shot(page, path) {
  const panel = page.locator('[data-dashboard="ai-utilization"] .ai-cmd-mid > section').first();
  await panel.screenshot({ path });
}

async function metrics(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-dashboard="ai-utilization"]');
    const grid = root?.querySelector('.ai-health-grid');
    const tiles = root?.querySelectorAll('.ai-health-tile') || [];
    const rows = root?.querySelectorAll('.ai-health-row') || [];
    const head = root?.querySelector('.ai-cmd-mid .ai-sec-head');
    const attn = root?.querySelector('.ai-attn-list');
    const opp = root?.querySelector('.ai-cmd-opp');
    const league = root?.querySelector('.ai-cmd-league');
    return {
      density: grid?.getAttribute('data-health-density'),
      compactClass: grid?.classList.contains('is-compact') ?? false,
      tileCount: tiles.length,
      rowCount: rows.length,
      header: (head?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      midOk: !!grid && !!attn,
      oppOk: !!opp,
      leagueOk: !!league,
      tileSample: [...tiles].slice(0, 1).map((el) => el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)),
      rowSample: [...rows].slice(0, 2).map((el) => el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120)),
    };
  });
}

async function loginAndOpen(page) {
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
  await page.waitForTimeout(2500);
}

async function main() {
  if (!fs.existsSync('C:/Temp')) fs.mkdirSync('C:/Temp', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await loginAndOpen(page);
  const rich = await metrics(page);
  await shot(page, 'C:/Temp/ai-health-adaptive-rich.png');
  console.log('RICH', JSON.stringify(rich, null, 2));
  await browser.close();
  if (rich.density !== 'rich' || rich.tileCount !== 3 || rich.rowCount !== 0) {
    console.error('Rich path unexpected');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
