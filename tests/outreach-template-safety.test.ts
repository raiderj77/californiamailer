import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOutreachDraft,
  outreachDraftCopyBlockReasons,
} from '../src/lib/outreachTemplates';

test('outreach drafts contain no static customer price and remain blocked on unresolved facts', () => {
  const introduction = createOutreachDraft('first_introduction');
  const hold = createOutreachDraft('category_reservation_notice');
  for (const draft of [introduction, hold]) {
    assert.doesNotMatch(`${draft.subject}\n${draft.body}`, /\$(?:349|479|8,376|11,496)\b/);
    assert.match(draft.body, /Commercial solicitation from CaliforniaMailer/);
    assert.match(draft.body, /Postal address: \[valid business postal address\]/);
    assert.match(draft.body, /To opt out of manual commercial email/);
    assert.ok(outreachDraftCopyBlockReasons(draft.subject, draft.body).length > 0);
  }
  assert.match(introduction.body, /5,000-piece planning target/);
  assert.match(introduction.body, /no USPS routes, residential address count, delivery date, or customer price is currently offered/i);
  assert.match(hold.body, /this template contains no static customer amount/i);
});

test('copy readiness requires every placeholder plus disclosure boundary to be resolved', () => {
  const draft = createOutreachDraft('first_introduction');
  const subject = draft.subject.replace(/\[[^\]\n]+\]/g, 'Verified category');
  const body = draft.body.replace(/\[[^\]\n]+\]/g, 'Owner-reviewed value');
  assert.deepEqual(outreachDraftCopyBlockReasons(subject, body), []);
  assert.ok(outreachDraftCopyBlockReasons(subject, body.replace('Commercial solicitation from CaliforniaMailer.', '')).length > 0);
  assert.ok(outreachDraftCopyBlockReasons(subject, body.replace('To opt out of manual commercial email', 'For preferences')).length > 0);
});
