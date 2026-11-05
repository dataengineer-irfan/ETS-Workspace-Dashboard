const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(45000);
  await page.goto("http://127.0.0.1:42005/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', "Admin@2026!");
  const user = page.locator('input[type="text"], input[name="username"]').first();
  await user.fill("admin");
  await Promise.all([
    page.waitForURL(/dashboard/, { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.goto("http://127.0.0.1:42005/dashboard?tab=ai_utilization", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-dashboard="ai-utilization"] .ai-kpis', { timeout: 90000 });
  await page.waitForSelector('.ai-cmd-quad', { timeout: 90000 });
  await page.waitForTimeout(4000);
  const measure = await page.evaluate(() => {
    const root = document.querySelector('[data-dashboard="ai-utilization"]');
    const quadWrap = root?.querySelector(".ai-cmd-quad .recharts-wrapper");
    const surface = root?.querySelector(".ai-cmd-quad .recharts-surface");
    const circles = root?.querySelectorAll(".ai-cmd-quad circle");
    const symbols = root?.querySelectorAll(".ai-cmd-quad .recharts-scatter-symbol, .ai-cmd-quad .recharts-symbols");
    const leagueRows = root?.querySelectorAll(".ai-cmd-quad tbody tr");
    const attn = root?.querySelector(".ai-attn-list");
    const tile = root?.querySelector(".ai-health-tile");
    const tileText = tile?.innerText || "";
    const leagueBox = root?.querySelector(".ai-cmd-quad section:last-child .custom-scrollbar, .ai-cmd-quad section:last-child > div.flex-1");
    const midCard = root?.querySelector(".ai-cmd-mid > section");
    return {
      page: root?.getAttribute("data-page"),
      scatterCircles: circles?.length || 0,
      scatterSymbols: symbols?.length || 0,
      circleAttrs: Array.from(circles || []).slice(0, 8).map((c) => ({ r: c.getAttribute("r"), cx: c.getAttribute("cx"), cy: c.getAttribute("cy"), fill: c.getAttribute("fill") })),
      quadW: quadWrap?.clientWidth || 0,
      quadH: quadWrap?.clientHeight || 0,
      surfaceW: surface ? surface.getBoundingClientRect().width : 0,
      surfaceH: surface ? surface.getBoundingClientRect().height : 0,
      leagueRows: leagueRows?.length || 0,
      leagueNames: Array.from(leagueRows || []).map((r) => r.textContent?.trim()),
      leagueScroll: leagueBox?.scrollHeight || null,
      leagueClient: leagueBox?.clientHeight || null,
      leagueOverflow: leagueBox ? getComputedStyle(leagueBox).overflowY : null,
      attnCount: root?.querySelectorAll(".ai-attn-card").length || 0,
      attnScroll: attn?.scrollHeight || null,
      attnClient: attn?.clientHeight || null,
      attnOverflow: attn ? getComputedStyle(attn).overflowY : null,
      tileH: tile?.clientHeight || null,
      tileScroll: tile?.scrollHeight || null,
      tileOverflow: tile ? getComputedStyle(tile).overflow : null,
      tileTextPreview: tileText.slice(0, 220),
      midH: midCard?.clientHeight || null,
      rootH: root?.clientHeight || null,
      rootScroll: root?.scrollHeight || null,
    };
  });
  console.log(JSON.stringify(measure, null, 2));
  await page.screenshot({ path: "C:/Temp/ai-debug-p1.png", fullPage: false });
  await browser.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
