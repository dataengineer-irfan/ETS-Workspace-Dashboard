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

  const opp = page.locator('[data-dashboard="ai-utilization"] .ai-cmd-opp');
  await opp.screenshot({ path: 'C:/Temp/ai-opp-one-pane.png' });

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('[data-dashboard="ai-utilization"]');
    const opp = root?.querySelector('.ai-cmd-opp');
    const body = opp?.querySelector('.ai-opp-body');
    const cardsWrap = opp?.querySelector('.ai-opp-cards');
    const funnel = opp?.querySelector('.ai-funnel');
    const cards = [...(opp?.querySelectorAll('.ai-opp-card') || [])];
    const steps = [...(opp?.querySelectorAll('.ai-funnel-step') || [])];
    const measure = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        display: cs.display,
        flex: cs.flex,
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        needsScroll: el.scrollHeight > el.clientHeight + 1,
      };
    };
    const cardBoxes = cards.map((el) => {
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), text: el.textContent?.replace(/\s+/g, ' ').trim() };
    });
    const stepBoxes = steps.map((el) => {
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), text: el.textContent?.replace(/\s+/g, ' ').trim() };
    });
    const bodyRect = body?.getBoundingClientRect();
    const clippedCards = cardBoxes.filter((c) => bodyRect && c.b > bodyRect.bottom + 1);
    const clippedSteps = stepBoxes.filter((s) => bodyRect && s.b > bodyRect.bottom + 1);
    return {
      body: measure(body),
      cardsWrap: measure(cardsWrap),
      funnel: measure(funnel),
      cardCount: cards.length,
      stepCount: steps.length,
      cardBoxes,
      stepBoxes,
      clippedCards,
      clippedSteps,
      header: opp?.querySelector('.ai-sec-head')?.textContent?.replace(/\s+/g, ' ').trim(),
    };
  });
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
  const bad =
    metrics.cardsWrap?.needsScroll ||
    metrics.funnel?.needsScroll ||
    metrics.cardsWrap?.overflowY === 'auto' ||
    metrics.funnel?.overflowY === 'auto' ||
    (metrics.clippedCards?.length || 0) > 0 ||
    (metrics.clippedSteps?.length || 0) > 0;
  if (bad) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
