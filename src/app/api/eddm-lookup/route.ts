// No verified carrier-route provider is connected. Never manufacture counts or
// serve demonstration routes from the production lookup endpoint.
export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get('zip');
  const headers = { 'Cache-Control': 'no-store' };

  if (!zip || !/^\d{5}$/.test(zip)) {
    return Response.json({ error: 'Invalid ZIP code' }, { status: 400, headers });
  }

  return Response.json(
    {
      error: 'Carrier-route lookup is unavailable. Verified USPS route counts are required before quoting.',
      code: 'ROUTE_DATA_UNAVAILABLE',
      routes: [],
    },
    { status: 503, headers },
  );
}
