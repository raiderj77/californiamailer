import { NextRequest, NextResponse } from 'next/server';

// Demo data - In production, integrate with USPS Web Tools API
// https://www.usps.com/business/web-tools-apis/
const demoRoutes: Record<string, any[]> = {
  '93908': [
    { zip: '93908', routeId: 'C001', city: 'Salinas', state: 'CA', residential: 487, business: 23, poBoxes: 0, total: 510 },
    { zip: '93908', routeId: 'C002', city: 'Salinas', state: 'CA', residential: 512, business: 18, poBoxes: 0, total: 530 },
    { zip: '93908', routeId: 'C003', city: 'Salinas', state: 'CA', residential: 623, business: 42, poBoxes: 0, total: 665 },
    { zip: '93908', routeId: 'C004', city: 'Salinas', state: 'CA', residential: 445, business: 15, poBoxes: 0, total: 460 },
    { zip: '93908', routeId: 'C005', city: 'Salinas', state: 'CA', residential: 398, business: 31, poBoxes: 0, total: 429 },
    { zip: '93908', routeId: 'R001', city: 'Salinas', state: 'CA', residential: 312, business: 8, poBoxes: 0, total: 320 },
    { zip: '93908', routeId: 'R002', city: 'Salinas', state: 'CA', residential: 287, business: 5, poBoxes: 0, total: 292 },
  ],
  '93923': [
    { zip: '93923', routeId: 'C001', city: 'Carmel', state: 'CA', residential: 342, business: 67, poBoxes: 0, total: 409 },
    { zip: '93923', routeId: 'C002', city: 'Carmel', state: 'CA', residential: 298, business: 45, poBoxes: 0, total: 343 },
    { zip: '93923', routeId: 'C003', city: 'Carmel', state: 'CA', residential: 412, business: 38, poBoxes: 0, total: 450 },
    { zip: '93923', routeId: 'R001', city: 'Carmel', state: 'CA', residential: 198, business: 12, poBoxes: 0, total: 210 },
  ],
  '93950': [
    { zip: '93950', routeId: 'C001', city: 'Pacific Grove', state: 'CA', residential: 523, business: 34, poBoxes: 0, total: 557 },
    { zip: '93950', routeId: 'C002', city: 'Pacific Grove', state: 'CA', residential: 478, business: 28, poBoxes: 0, total: 506 },
    { zip: '93950', routeId: 'C003', city: 'Pacific Grove', state: 'CA', residential: 445, business: 41, poBoxes: 0, total: 486 },
    { zip: '93950', routeId: 'C004', city: 'Pacific Grove', state: 'CA', residential: 367, business: 19, poBoxes: 0, total: 386 },
    { zip: '93950', routeId: 'R001', city: 'Pacific Grove', state: 'CA', residential: 234, business: 6, poBoxes: 0, total: 240 },
  ],
  '93940': [
    { zip: '93940', routeId: 'C001', city: 'Monterey', state: 'CA', residential: 612, business: 89, poBoxes: 0, total: 701 },
    { zip: '93940', routeId: 'C002', city: 'Monterey', state: 'CA', residential: 534, business: 72, poBoxes: 0, total: 606 },
    { zip: '93940', routeId: 'C003', city: 'Monterey', state: 'CA', residential: 487, business: 56, poBoxes: 0, total: 543 },
    { zip: '93940', routeId: 'C004', city: 'Monterey', state: 'CA', residential: 423, business: 48, poBoxes: 0, total: 471 },
    { zip: '93940', routeId: 'C005', city: 'Monterey', state: 'CA', residential: 398, business: 34, poBoxes: 0, total: 432 },
    { zip: '93940', routeId: 'R001', city: 'Monterey', state: 'CA', residential: 276, business: 11, poBoxes: 0, total: 287 },
  ],
};

// Generate realistic demo data for any ZIP code
function generateDemoRoutes(zip: string) {
  const cities: Record<string, string> = {
    '9': 'California City',
    '8': 'Phoenix Area',
    '7': 'Texas City', 
    '6': 'Midwest City',
    '5': 'Central City',
    '4': 'Eastern City',
    '3': 'Southeast City',
    '2': 'DC Area',
    '1': 'Northeast City',
    '0': 'New England City',
  };

  const state = zip.startsWith('9') ? 'CA' : 'US';
  const city = cities[zip[0]] || 'Unknown City';
  const numRoutes = 4 + Math.floor(Math.random() * 6); // 4-9 routes

  const routes = [];
  for (let i = 1; i <= numRoutes; i++) {
    const isRural = i > numRoutes - 2;
    const routeId = isRural ? `R00${i - (numRoutes - 2)}` : `C00${i}`;
    const residential = isRural 
      ? 150 + Math.floor(Math.random() * 200)
      : 350 + Math.floor(Math.random() * 300);
    const business = isRural
      ? 5 + Math.floor(Math.random() * 15)
      : 20 + Math.floor(Math.random() * 60);

    routes.push({
      zip,
      routeId,
      city,
      state,
      residential,
      business,
      poBoxes: 0,
      total: residential + business,
    });
  }

  return routes;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip');

  if (!zip || zip.length !== 5) {
    return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 });
  }

  // Check for demo data first, otherwise generate
  const routes = demoRoutes[zip] || generateDemoRoutes(zip);

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return NextResponse.json({ routes });
}
