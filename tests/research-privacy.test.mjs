import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const research = readFileSync(
  new URL('../docs/FACELESS_SALES_RESEARCH.md', import.meta.url),
  'utf8',
);
const releaseDocs = [
  '../README.md',
  '../docs/IMPLEMENTATION_PLAN.md',
  '../docs/FINAL_DELIVERY.md',
  '../docs/CHANGE_MANIFEST.md',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

test('faceless-sales research keeps conclusions without private account provenance', () => {
  assert.doesNotMatch(research, /C:\\Users\\/i);
  assert.doesNotMatch(research, /Google Drive|OneDrive|Gmail/i);
  assert.doesNotMatch(research, /purchase\/access evidence|private Drive|private mailbox/i);
  assert.match(research, /Account locations, storage links, file IDs, mailbox history, purchase or access records/);
  assert.match(research, /The durable conclusions are:/);
  assert.match(research, /Sensitive consumer targeting/);
  assert.match(research, /reviewed research did not establish a reliable 9x12\/24-slot profit calculator/);
});

test('release documentation has no account-specific local paths or stale unpublished-PR claims', () => {
  assert.doesNotMatch(releaseDocs, /[A-Z]:[\\/]Users[\\/][^\\/]+/i);
  assert.doesNotMatch(releaseDocs, /remains local and unpushed|no open PR|never run on GitHub/i);
  assert.doesNotMatch(releaseDocs, /CI passed for (?:the |its )?initial .*revision|final integration (?:commit and checks|checks) (?:are |still )?pending/i);
  assert.doesNotMatch(releaseDocs, /normal local `npm ci` directory (?:is still )?required/i);
  assert.match(releaseDocs, /Draft PR #3 is open/);
  assert.match(releaseDocs, /exact current PR head/i);
  assert.match(releaseDocs, /GitHub Actions/i);
  assert.match(releaseDocs, /Nothing was deployed/i);
});
