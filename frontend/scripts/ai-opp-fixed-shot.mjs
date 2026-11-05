import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  if (!fs.existsSync('C:/Temp')) fs.mkdirSync('C:/Temp', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:42005/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByPlaceholder(/admin or employee/i).fill('admin');
  await page.getByPlaceholder(/account password/i).fill('Admin@2026!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.goto('http://localhost:42005/dashboard?tab=ai_utilization', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-dashboard="ai-utilization"] .ai-cmd-opp', { timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Temp/ai-opp-fixed.png', fullPage: false });

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('[data-dashboard="ai-utilization"]');
    const opp = root?.querySelector('.ai-cmd-opp');
    const body = opp?.querySelector('.ai-opp-body');
    const cards = [...(opp?.querySelectorAll('.ai-opp-card') || [])];
    const steps = [...(opp?.querySelectorAll('.ai-funnel-step') || [])];
    const bodyCs = body ? getComputedStyle(body) : null;
    const cardBoxes = cards.map((el) => {
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), text: el.textContent?.replace(/\s+/g, ' ').trim() };
    });
    const stepBoxes = steps.map((el) => {
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), text: el.textContent?.replace(/\s+/g, ' ').trim() };
    });
    const overlaps = (a, b) => a.t < b.b && b.t < a.b && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;
    const cardOverlap = cardBoxes.some((a, i) => cardBoxes.slice(i + 1).some((b) => overlaps(a, b)));
    const stepOverlap = stepBoxes.some((a, i) => stepBoxes.slice(i + 1).some((b) => overlaps(a, b)));
    return {
      bodyCols: bodyCs?.gridTemplateColumns,
      bodyRows: bodyCs?.gridTemplateRows,
      cardCount: cards.length,
      stepCount: steps.length,
      cardBoxes,
      stepBoxes,
      cardOverlap,
      stepOverlap,
      header: opp?.querySelector('.ai-sec-head')?.textContent?.replace(/\s+/g, ' ').trim(),
    };
  });
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
  if (metrics.cardOverlap || metrics.stepOverlap) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
