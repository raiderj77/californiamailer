import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Online checkout is unavailable. Request a verified written quote before payment.' },
    { status: 503 }
  );
}
