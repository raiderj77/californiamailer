import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

const services = new Set(['coop', 'eddm', 'solo']);
const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || body.kind !== 'quote') {
    return NextResponse.json({ error: 'Unsupported email request.' }, { status: 400 });
  }

  if (clean(body.website, 200)) {
    return NextResponse.json({ success: true });
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 40);
  const business = clean(body.business, 120);
  const serviceType = clean(body.serviceType, 20);
  const city = clean(body.city, 80);
  const quantity = clean(body.quantity, 40);
  const message = clean(body.message, 2_000);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || !business || !validEmail || !services.has(serviceType) || !city) {
    return NextResponse.json({ error: 'Enter the required quote details.' }, { status: 400 });
  }

  const text = [
    'New CaliforniaMailer quote request',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Business: ${business}`,
    `Service: ${serviceType}`,
    `Target city or area: ${city}`,
    `Quantity: ${quantity || 'Not specified'}`,
    '',
    'Additional details:',
    message || 'None provided',
  ].join('\n');

  const result = await sendEmail({
    to: 'hello@californiamailer.com',
    subject: `Quote request: ${serviceType.toUpperCase()} - ${business}`,
    text,
  });

  if (!result.success) {
    return NextResponse.json({ error: 'Quote request could not be delivered.' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
