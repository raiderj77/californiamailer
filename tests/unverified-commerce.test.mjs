import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/app/api/eddm-lookup/route.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { GET } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('known demo and arbitrary ZIPs never return usable route data', async () => {
  for (const zip of ['93908', '93923', '93950', '93940', '10001', '00000', '99999']) {
    const response = await GET(new Request(`http://localhost/api/eddm-lookup?zip=${zip}`));
    assert.equal(response.status, 503, zip);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.deepEqual(data.routes, []);
    assert.equal(data.code, 'ROUTE_DATA_UNAVAILABLE');
    assert.match(data.error, /unavailable/);
    assert.doesNotMatch(JSON.stringify(data), /residential|routeId|postage|business|total/);
  }
});

test('missing, malformed and nonnumeric ZIPs are invalid, without route data', async () => {
  for (const suffix of ['', '?zip=', '?zip=1234', '?zip=123456', '?zip=abcde', '?zip=%201234', '?zip=12.34']) {
    const response = await GET(new Request('http://localhost/api/eddm-lookup' + suffix));
    assert.equal(response.status, 400, suffix);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Invalid ZIP code' });
  }
});

test('payment return page cannot infer payment or order acceptance from a timer or URL', () => {
  const page = read('src/app/(public)/payment-success/page.tsx');
  assert.match(page, /Payment status unverified/);
  assert.match(page, /Online checkout is currently unavailable/);
  assert.doesNotMatch(page, /setTimeout|useEffect|useSearchParams|session_id|Payment Successful|Confirmation ID|received your order|confirmation email|Start Another Order/);
});
