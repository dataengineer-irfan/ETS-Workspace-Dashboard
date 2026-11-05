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
  await page.waitForSelector('[data-dashboard="ai-utilization"] .ai-cmd-bottom', { timeout: 45000 });
  await page.waitForTimeout(2800);

  const opp = page.locator('[data-dashboard="ai-utilization"] .ai-cmd-opp');
  const league = page.locator('[data-dashboard="ai-utilization"] .ai-cmd-league');
  await opp.screenshot({ path: 'C:/Temp/ai-opp-funnel-half.png' });
  await league.screenshot({ path: 'C:/Temp/ai-league-enhanced.png' });

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('[data-dashboard="ai-utilization"]');
    const bottom = root?.querySelector('.ai-cmd-bottom');
    const opp = root?.querySelector('.ai-cmd-opp');
    const league = root?.querySelector('.ai-cmd-league');
    const quad = root?.querySelector('.ai-cmd-quad');
    const cards = root?.querySelectorAll('.ai-opp-card');
    const funnel = opp?.querySelector('.ai-funnel');
    const steps = [...(opp?.querySelectorAll('.ai-funnel-step') || [])];
    const leagueRows = league?.querySelectorAll('tbody tr') || [];
    const ths = [...(league?.querySelectorAll('thead th') || [])].map((el) => el.textContent?.trim());
    const cs = bottom ? getComputedStyle(bottom) : null;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), l: Math.round(r.left) };
    };
    const funnelNeed = funnel ? funnel.scrollHeight > funnel.clientHeight + 1 : null;
    return {
      bottomDisplay: cs?.display,
      bottomCols: cs?.gridTemplateColumns,
      bottomRows: cs?.gridTemplateRows,
      oppBox: box(opp),
      leagueBox: box(league),
      quadBox: box(quad),
      leftCards: cards?.length ?? 0,
      stepCount: steps.length,
      stepTexts: steps.map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
      funnelOverflowY: funnel ? getComputedStyle(funnel).overflowY : null,
      funnelNeedsScroll: funnelNeed,
      leagueCols: ths,
      leagueRowCount: leagueRows.length,
      header: opp?.querySelector('.ai-sec-head')?.textContent?.replace(/\s+/g, ' ').trim(),
      leagueHeader: league?.querySelector('.ai-sec-head')?.textContent?.replace(/\s+/g, ' ').trim(),
      midOk: !!root?.querySelector('.ai-cmd-mid .ai-health-grid') && !!root?.querySelector('.ai-attn-list'),
    };
  });
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
  const bad =
    metrics.leftCards > 0 ||
    metrics.stepCount !== 4 ||
    metrics.funnelNeedsScroll ||
    metrics.funnelOverflowY === 'auto' ||
    !metrics.leagueCols?.includes('Projects') ||
    (metrics.leagueRowCount || 0) < 10 ||
    !metrics.midOk;
  if (bad) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
