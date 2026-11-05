import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  // Temporary force via DOM mutation is insufficient; patch constant briefly through evaluate won't work.
  // Re-use file toggle: read current HEALTH_COMPACT_AT from disk by forcing compact through URL is unavailable.
  // Instead duplicate nodes visually is skipped — re-shot with temporary override already done.
  // Just verify CSS after restore: force compact by injecting class + cloning is messy.
  // Quick check: compute accent vars on a synthetic element in page after HMR.
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:42005/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByPlaceholder(/admin or employee/i).fill('admin');
  await page.getByPlaceholder(/account password/i).fill('Admin@2026!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.goto('http://127.0.0.1:42005/dashboard?tab=ai_utilization', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-dashboard="ai-utilization"] .ai-health-grid', { timeout: 45000 });
  await page.waitForTimeout(1500);
  const vars = await page.evaluate(() => {
    const el = document.createElement('button');
    el.className = 'ai-health-row glass-panel ai-health-accent-amber';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = {
      rail: cs.getPropertyValue('--health-rail').trim(),
      score: cs.getPropertyValue('--health-score').trim(),
      tint: cs.getPropertyValue('--health-tint').trim(),
    };
    el.remove();
    return out;
  });
  console.log(JSON.stringify(vars));
  await browser.close();
  if (!vars.rail || vars.rail === '#64748b') process.exit(2);
}
main().catch((e) => { console.error(e); process.exit(1); });
