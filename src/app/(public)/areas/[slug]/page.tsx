export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cityNames: Record<string, string> = {
    'salinas': 'Salinas',
    'monterey': 'Monterey',
    'carmel': 'Carmel',
    'carmel-valley': 'Carmel Valley',
    'pacific-grove': 'Pacific Grove',
    'seaside': 'Seaside',
    'marina': 'Marina',
  };
  
  const cityName = cityNames[params.slug] || 'Monterey County';
  
  return {
    title: `Direct Mail Services in ${cityName} | CaliforniaMailer`,
    description: `Affordable EDDM and co-op postcard services in ${cityName}, CA. Reach every household in your target neighborhoods. Starting at $0.242 per piece. Professional design included.`,
  };
}
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface CityData {
  name: string;
  slug: string;
  county: string;
  households: string;
  medianIncome: string;
  description: string;
  zipCodes: string[];
  neighborhoods: string[];
  topCategories: string[];
  coopPrice: number;
}

const cities: Record<string, CityData> = {
  'salinas': {
    name: 'Salinas',
    slug: 'salinas',
    county: 'Monterey',
    households: '45,000+',
    medianIncome: '$65,000',
    description: 'Salinas is the largest city in Monterey County and the agricultural hub of the Salinas Valley. With a diverse population and strong local economy, it offers excellent opportunities for businesses targeting homeowners and families.',
    zipCodes: ['93901', '93905', '93906', '93907', '93908'],
    neighborhoods: ['Creekbridge', 'Santa Rita', 'Harden Ranch', 'North Salinas', 'Alisal', 'Downtown'],
    topCategories: ['HVAC', 'Plumbing', 'Roofing', 'Auto Repair', 'Restaurants', 'Dental'],
    coopPrice: 399,
  },
  'monterey': {
    name: 'Monterey',
    slug: 'monterey',
    county: 'Monterey',
    households: '28,000+',
    medianIncome: '$85,000',
    description: 'Monterey is a premier tourist destination known for Cannery Row, the Aquarium, and beautiful coastline. The affluent residential areas offer high-value customers for local service providers.',
    zipCodes: ['93940', '93943', '93944'],
    neighborhoods: ['Del Monte', 'New Monterey', 'Old Monterey', 'Skyline', 'Casanova Oak Knoll'],
    topCategories: ['Real Estate', 'Restaurants', 'Home Services', 'Professional Services', 'Fitness'],
    coopPrice: 449,
  },
  'carmel': {
    name: 'Carmel-by-the-Sea & Carmel Valley',
    slug: 'carmel',
    county: 'Monterey',
    households: '12,000+',
    medianIncome: '$125,000',
    description: 'Carmel-by-the-Sea and Carmel Valley represent some of the most affluent communities in California. Residents here have high disposable income and appreciate quality services.',
    zipCodes: ['93921', '93922', '93923', '93924'],
    neighborhoods: ['Carmel-by-the-Sea', 'Carmel Valley Village', 'Mid Valley', 'Carmel Highlands', 'Pebble Beach'],
    topCategories: ['Real Estate', 'Landscaping', 'Interior Design', 'Fine Dining', 'Luxury Services'],
    coopPrice: 549,
  },
  'pacific-grove': {
    name: 'Pacific Grove',
    slug: 'pacific-grove',
    county: 'Monterey',
    households: '15,000+',
    medianIncome: '$78,000',
    description: 'Pacific Grove is a charming coastal city known for its Victorian homes and Monarch butterfly sanctuary. The tight-knit community values local businesses and quality services.',
    zipCodes: ['93950'],
    neighborhoods: ['Downtown', 'Asilomar', 'Candy Cane Lane', 'Country Club Gate', 'Del Monte Park'],
    topCategories: ['Restaurants', 'Home Services', 'Pet Services', 'Health & Wellness', 'Retail'],
    coopPrice: 425,
  },
  'seaside': {
    name: 'Seaside',
    slug: 'seaside',
    county: 'Monterey',
    households: '18,000+',
    medianIncome: '$58,000',
    description: 'Seaside is a diverse, growing community with excellent value for direct mail campaigns. The city has seen significant development and offers strong opportunities for service businesses.',
    zipCodes: ['93955'],
    neighborhoods: ['Broadway', 'Fremont', 'Ord Grove', 'Del Rey Oaks'],
    topCategories: ['Auto Services', 'Restaurants', 'Tax Services', 'Fitness', 'Retail'],
    coopPrice: 349,
  },
  'marina': {
    name: 'Marina',
    slug: 'marina',
    county: 'Monterey',
    households: '14,000+',
    medianIncome: '$62,000',
    description: 'Marina is one of the fastest-growing cities in Monterey County, with new housing developments and a young, active population. Great for businesses targeting families and new homeowners.',
    zipCodes: ['93933'],
    neighborhoods: ['Marina Heights', 'Preston Park', 'Dunes', 'Sea Haven'],
    topCategories: ['Home Services', 'Restaurants', 'Childcare', 'Fitness', 'Pet Services'],
    coopPrice: 375,
  },
};

export function generateStaticParams() {
  return Object.keys(cities).map((slug) => ({ slug }));
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = cities[slug];

  if (!city) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold text-blue-600">CaliforniaMailer</Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/services" className="text-gray-600 hover:text-gray-900">Services</Link>
            <Link href="/coop-board" className="text-gray-600 hover:text-gray-900">Co-op Board</Link>
            <Link href="/quote" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Get a Quote</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-4">
            <Link href="/home" className="hover:text-white">Home</Link>
            <span>›</span>
            <Link href="/home#areas" className="hover:text-white">Service Areas</Link>
            <span>›</span>
            <span className="text-white">{city.name}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Direct Mail Services in {city.name}
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            Reach {city.households} households in {city.name} with targeted EDDM postcards and co-op mailers. 
            No mailing list required.
          </p>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="bg-gray-900 text-white py-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">{city.households}</div>
              <div className="text-gray-400 text-sm">Households</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{city.medianIncome}</div>
              <div className="text-gray-400 text-sm">Median Income</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">${city.coopPrice}</div>
              <div className="text-gray-400 text-sm">Co-op Spot Price</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{city.zipCodes.length}</div>
              <div className="text-gray-400 text-sm">ZIP Codes</div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-10">
            {/* About */}
            <div>
              <h2 className="text-2xl font-bold mb-4">About {city.name}</h2>
              <p className="text-gray-600 leading-relaxed">{city.description}</p>
            </div>

            {/* Neighborhoods */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Neighborhoods We Serve</h2>
              <div className="grid grid-cols-2 gap-3">
                {city.neighborhoods.map((n) => (
                  <div key={n} className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-2">
                    <span className="text-blue-600">📍</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ZIP Codes */}
            <div>
              <h2 className="text-2xl font-bold mb-4">ZIP Codes</h2>
              <div className="flex flex-wrap gap-2">
                {city.zipCodes.map((zip) => (
                  <span key={zip} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium">
                    {zip}
                  </span>
                ))}
              </div>
              <p className="text-gray-500 text-sm mt-3">
                We can target specific carrier routes within each ZIP code for precise neighborhood targeting.
              </p>
            </div>

            {/* Top Categories */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Popular Business Categories</h2>
              <p className="text-gray-600 mb-4">
                These business types see the best results from direct mail in {city.name}:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {city.topCategories.map((cat) => (
                  <div key={cat} className="border rounded-lg px-4 py-3 text-center hover:border-blue-600 hover:bg-blue-50 transition-colors">
                    {cat}
                  </div>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Services Available in {city.name}</h2>
              <div className="space-y-4">
                <div className="border rounded-xl p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold">Co-op Postcards</h3>
                    <span className="text-blue-600 font-bold">${city.coopPrice}/spot</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    Share a 9x12 postcard with other local businesses. Everything included.
                  </p>
                  <Link href="/coop-board" className="text-blue-600 text-sm font-medium hover:underline">
                    View available spots →
                  </Link>
                </div>
                <div className="border rounded-xl p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold">EDDM Mailings</h3>
                    <span className="text-blue-600 font-bold">$0.24+/piece</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    Your own postcard to every door. Choose exact routes and neighborhoods.
                  </p>
                  <Link href="/quote" className="text-blue-600 text-sm font-medium hover:underline">
                    Get a quote →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* CTA Card */}
            <div className="bg-blue-600 text-white rounded-xl p-6">
              <h3 className="text-xl font-bold mb-2">Ready to Reach {city.name}?</h3>
              <p className="text-blue-100 mb-4 text-sm">
                Get a free quote for your {city.name} direct mail campaign.
              </p>
              <Link
                href={`/quote?city=${city.slug}`}
                className="block bg-white text-blue-600 text-center py-3 rounded-lg font-bold hover:bg-blue-50"
              >
                Get Free Quote
              </Link>
            </div>

            {/* Quick Facts */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-bold mb-4">Quick Facts</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">County:</dt>
                  <dd className="font-medium">{city.county}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Households:</dt>
                  <dd className="font-medium">{city.households}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Median Income:</dt>
                  <dd className="font-medium">{city.medianIncome}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Co-op Price:</dt>
                  <dd className="font-medium text-blue-600">${city.coopPrice}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">EDDM Cost/Home:</dt>
                  <dd className="font-medium text-blue-600">$0.24-$0.35</dd>
                </div>
              </dl>
            </div>

            {/* Other Areas */}
            <div className="border rounded-xl p-6">
              <h3 className="font-bold mb-4">Other Service Areas</h3>
              <ul className="space-y-2 text-sm">
                {Object.values(cities)
                  .filter((c) => c.slug !== city.slug)
                  .map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/areas/${c.slug}`}
                        className="flex justify-between items-center hover:text-blue-600"
                      >
                        <span>{c.name}</span>
                        <span className="text-gray-400">{c.households}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="border rounded-xl p-6">
              <h3 className="font-bold mb-4">Questions?</h3>
              <p className="text-sm text-gray-600 mb-3">
                We're happy to help you plan your {city.name} campaign.
              </p>
              <div className="text-sm space-y-1">
                <div>📧 hello@californiamailer.com</div>
                <div>📞 (831) 555-0100</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="bg-gray-100 py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Start Reaching {city.name} Customers Today</h2>
          <p className="text-gray-600 mb-6">
            Join hundreds of local businesses using direct mail to grow in {city.name}.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/quote" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700">
              Get a Free Quote
            </Link>
            <Link href="/coop-board" className="border border-gray-300 bg-white px-6 py-3 rounded-lg font-medium hover:bg-gray-50">
              View Co-op Board
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm">
          <p>© {new Date().getFullYear()} CaliforniaMailer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
