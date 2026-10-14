import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import axe from 'axe-core';
const base = process.argv[2] || 'http://127.0.0.1:3129';
const planner = 'https://plan.californiamailer.com/';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local QA only');
await mkdir('qa', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const blocked = [];
    await page.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).origin !== new URL(base).origin || request.method() !== 'GET' || new URL(request.url()).pathname.startsWith('/api/')) {
        blocked.push(request.method() + ' ' + request.url());
        return route.abort();
      }
      return route.continue();
    });
    for (const route of ['/', '/coop-board', '/services', '/quote', '/privacy', '/terms', '/areas/salinas', '/areas/carmel-valley']) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      const copy = await page.locator('main').textContent();
      assert.doesNotMatch(copy, /\$(?:399|599)\b/, `${route} stale package prices`);
      assert.equal(await page.locator('h1').count(), 1, route);
      assert.equal(await page.locator('main').count(), 1, route);
      assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://californiamailer.com' + (route === '/' ? '' : route));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} ${width} overflow`);
      const links = await page.getByRole('link', { name: 'Plan my mailing', exact: true }).all();
      assert.ok(links.length > 0);
      for (const link of links) assert.equal(await link.getAttribute('href'), planner);
      assert.equal(await page.locator('a[href*="chatgpt.site"]').count(), 0, `${route} no fallback CTA`);
      if (route === '/' || route === '/coop-board') {
        assert.match(copy, /\$499/);
        assert.match(copy, /\$799/);
        assert.match(copy, /written proof approval/);
        assert.match(copy, /reusable approved digital ad/);
        assert.match(copy, /actual mailing-acceptance evidence/);
        assert.equal(await page.locator('[data-sample-slot]').count(), 16);
        const slots = await page.locator('[data-sample-slot]').evaluateAll(nodes => nodes.map(node => {const r = node.getBoundingClientRect(); return [r.width, r.height];}));
        assert.ok(slots.every(([w,h]) => Math.abs(w-slots[0][0]) < 1 && Math.abs(h-slots[0][1]) < 1), 'equal slots');
      }
      await page.evaluate(axe.source);
      const violations = await page.evaluate(async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}})).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, [], `${route} ${width} accessibility`);
      if (route === '/') {
        await page.locator('summary').first().click();
        assert.equal(await page.locator('details').first().getAttribute('open'), '');
        await page.locator('summary').first().click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({path: `qa/home-${width}.png`, fullPage: true});
        await page.screenshot({path: `qa/hero-${width}.png`});
      }
      console.log(`PASS ${width}px ${route}`);
    }
    await page.goto(base + '/services', { waitUntil: 'networkidle' });
    const design = page.locator('#design').getByRole('link', { name: 'Request design & print support', exact: true });
    assert.equal(await design.getAttribute('href'), '/quote?service=design');
    await page.screenshot({ path: `qa/services-${width}.png`, fullPage: true });
    await design.click();
    await page.waitForURL('**/quote?service=design');
    await page.waitForFunction(() => document.querySelector('#quote-service')?.value === 'design');
    assert.equal(await page.locator('#quote-service').inputValue(), 'design');
    assert.equal(await page.locator('#quote-quantity').inputValue(), '2500');
    assert.equal(await page.getByLabel('Approximate number of pieces', { exact: true }).count(), 1);
    await page.screenshot({ path: `qa/design-quote-${width}.png`, fullPage: true });
    // The URL only supplies an initial choice; visitors remain free to change it.
    await page.locator('#quote-service').selectOption('coop');
    assert.equal(await page.locator('#quote-quantity').inputValue(), '1');
    await page.locator('#quote-service').selectOption('design');
    assert.equal(await page.locator('#quote-quantity').inputValue(), '2500');
    for (const service of ['eddm', 'design', 'solo', 'coop', '', 'unknown', 'DESIGN', '<script>']) {
      await page.goto(base + '/quote?service=' + encodeURIComponent(service), { waitUntil: 'networkidle' });
      const expected = ['eddm', 'design', 'solo', 'coop'].includes(service) ? service : 'coop';
      assert.equal(await page.locator('#quote-service').inputValue(), expected, `validated service ${service}`);
      assert.equal(await page.locator('#quote-quantity').inputValue(), expected === 'coop' ? '1' : '2500');
      assert.equal(await page.locator('#quote-name').inputValue(), '');
      assert.equal(await page.locator('#quote-email').inputValue(), '');
    }
    await page.goto(base + '/quote', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#quote-service').inputValue(), 'coop', 'default service unchanged');
    assert.deepEqual(blocked, [], 'no external, API or non-GET requests attempted');
    console.log(`PASS ${width}px design CTA, validated query preselection and manual service changes; no submission`);
    await page.close();
  }
  const page = await browser.newPage();
  const response = await page.goto(base + '/home');
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(response.status(), 200);
  console.log('PASS legacy /home redirect; no forms submitted or APIs called');
} finally { await browser.close(); }
