import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Automated route lookup is disabled because no verified USPS data connection is configured.',
      officialSource: 'https://postalpro.usps.com/mailing/every-door-direct-mail',
    },
    { status: 503 },
  );
}
