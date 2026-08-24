import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/reservations/[id]/coupon/route';

const context = { params: Promise.resolve({ id: 'Reservation123' }) };

test('coupon mutations reject a missing Origin before reading the body or database', async () => {
  const request = new NextRequest(
    'https://californiamailer.example/api/reservations/Reservation123/coupon',
    { method: 'POST', body: '{not-json' },
  );
  const response = await POST(request, context);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'A same-origin coupon request is required.' });
});

test('coupon mutations reject a cross-site Origin before reading the body or database', async () => {
  const request = new NextRequest(
    'https://californiamailer.example/api/reservations/Reservation123/coupon',
    {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
      body: '{not-json',
    },
  );
  const response = await POST(request, context);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'A same-origin coupon request is required.' });
});
