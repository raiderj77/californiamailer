import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import axe from 'axe-core';
const base = process.argv[2] || 'http://127.0.0.1:3136';
const target = new URL(base);
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'Local QA only');
await mkdir('qa-safety', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext();
  const blocked = [];
  await context.route('**/*', route => {
    const request = route.request();
    if (new URL(request.url()).origin !== target.origin || request.method() !== 'GET') {
      blocked.push(request.method() + ' ' + new URL(request.url()).pathname);
      return route.abort();
    }
    return route.continue();
  });
  for (const width of [390, 1440]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    for (const suffix of ['', '?session_id=cs_test_fabricated', '?session_id=cs_live_fabricated', '?session_id=%3Cscript%3E']) {
      const response = await page.goto(base + '/payment-success' + suffix, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.equal(await page.getByRole('heading', { name: 'Payment status unverified', exact: true }).count(), 1);
      await page.waitForTimeout(1800); // Beyond the previous false-success timer.
      const copy = await page.locator('body').innerText();
      assert.match(copy, /Payment status unverified/);
      assert.doesNotMatch(copy, /Payment Successful|Confirmation ID|received your order|cs_live_fabricated|cs_test_fabricated/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await page.evaluate(axe.source);
    const serious = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id));
    assert.deepEqual(serious, []);
    await page.screenshot({ path: `qa-safety/payment-unverified-${width}.png`, fullPage: true });
    await page.goto(base, { waitUntil: 'networkidle' });
    const home = await page.locator('main').innerText();
    assert.match(home, /\$499/);
    assert.match(home, /\$799/);
    const planner = page.getByRole('link', { name: 'Plan my mailing', exact: true });
    assert.ok(await planner.count() > 0);
    for (const link of await planner.all()) assert.equal(await link.getAttribute('href'), 'https://plan.californiamailer.com/');
    console.log(`PASS ${width}px unverified payment, no query-based confirmation, accessibility, prices and planner links`);
    await page.close();
  }
  for (const zip of ['93908', '10001', 'abcde']) {
    const response = await fetch(base + '/api/eddm-lookup?zip=' + zip);
    assert.equal(response.status, zip === 'abcde' ? 400 : 503);
    const data = await response.json();
    if (zip !== 'abcde') assert.deepEqual(data.routes, []);
  }
  console.log('PASS local GET lookup checks; no form submission or checkout request');
  console.log('Blocked external or non-GET browser requests:', blocked.length);
} finally { await browser.close(); }
