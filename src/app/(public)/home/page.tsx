import { californiaMailerOrg } from '@/lib/schemas/organization';
import { directMailService } from '@/lib/schemas/service';
import Link from 'next/link';

export default function HomePage() {
  const cities = [
    { name: 'Salinas', slug: 'salinas', households: '45,000+' },
    { name: 'Monterey', slug: 'monterey', households: '28,000+' },
    { name: 'Carmel', slug: 'carmel', households: '12,000+' },
    { name: 'Pacific Grove', slug: 'pacific-grove', households: '15,000+' },
    { name: 'Seaside', slug: 'seaside', households: '18,000+' },
    { name: 'Marina', slug: 'marina', households: '14,000+' },
  ];

  const testimonials = [
    { name: 'Mike R.', business: 'HVAC Contractor', text: 'Filled my schedule for 3 months with one mailing.' },
    { name: 'Sarah L.', business: 'Real Estate Agent', text: 'Best ROI of any marketing I\'ve tried.' },
    { name: 'Tom K.', business: 'Restaurant Owner', text: 'Our lunch crowd doubled after the co-op card.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(californiaMailerOrg)
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(directMailService)
        }}
      />
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold text-blue-600">
            CaliforniaMailer
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/services" className="text-gray-600 hover:text-gray-900">Services</Link>
            <Link href="/home#areas" className="text-gray-600 hover:text-gray-900">Areas</Link>
            <Link href="/home#pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link href="/coop-board" className="text-gray-600 hover:text-gray-900">Co-op Board</Link>
            <Link href="/quote" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Get a Quote
            </Link>
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
              Client Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-block bg-blue-500/30 text-blue-100 px-4 py-1 rounded-full text-sm mb-6">
              🎯 Monterey County's #1 Direct Mail Service
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Reach Every Door in Your Target Neighborhood
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              EDDM postcards starting at <span className="text-white font-bold">$0.24/home</span>. 
              Co-op spots from <span className="text-white font-bold">$299</span>. 
              No mailing list needed. Design included.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                href="/quote" 
                className="bg-white text-blue-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-blue-50 shadow-lg"
              >
                Get Your Free Quote
              </Link>
              <Link 
                href="/coop-board" 
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10"
              >
                View Available Spots
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-blue-200 text-sm">
              <span>✓ No contracts</span>
              <span>✓ Free design</span>
              <span>✓ 2-week turnaround</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-900 text-white py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-400">500K+</div>
              <div className="text-gray-400 text-sm">Postcards Delivered</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-400">850+</div>
              <div className="text-gray-400 text-sm">Local Businesses Served</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-400">4.4%</div>
              <div className="text-gray-400 text-sm">Avg Response Rate</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-400">$0.24</div>
              <div className="text-gray-400 text-sm">Cost Per Home</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Get your business in front of thousands of local homeowners in 3 simple steps
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📍</span>
              </div>
              <div className="text-blue-600 font-bold text-sm mb-2">STEP 1</div>
              <h3 className="text-xl font-bold mb-2">Choose Your Area</h3>
              <p className="text-gray-600">
                Pick the neighborhoods you want to target. We'll show you exactly how many homes you'll reach.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎨</span>
              </div>
              <div className="text-blue-600 font-bold text-sm mb-2">STEP 2</div>
              <h3 className="text-xl font-bold mb-2">We Design Your Ad</h3>
              <p className="text-gray-600">
                Our designers create eye-catching postcards that get results. Unlimited revisions included.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📬</span>
              </div>
              <div className="text-blue-600 font-bold text-sm mb-2">STEP 3</div>
              <h3 className="text-xl font-bold mb-2">We Handle Everything</h3>
              <p className="text-gray-600">
                Print, postage, delivery — all done for you. Your postcard arrives in mailboxes within 2 weeks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Our Services</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Choose the option that fits your budget and goals
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Co-op Card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-blue-600 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                MOST POPULAR
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Co-op Postcard</h3>
              <div className="text-3xl font-bold text-blue-600 mb-1">$299-$500</div>
              <div className="text-gray-500 text-sm mb-4">per spot</div>
              <p className="text-gray-600 mb-6">
                Share a 9x12 postcard with 8-10 other local businesses. Maximum exposure at minimum cost.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 10,000+ homes reached</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Design included</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Print & postage included</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Category exclusivity</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> ~$0.03-$0.05 per home</li>
              </ul>
              <Link href="/coop-board" className="block text-center bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700">
                View Available Spots
              </Link>
            </div>

            {/* EDDM */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">📬</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">EDDM Postcards</h3>
              <div className="text-3xl font-bold text-blue-600 mb-1">$0.24</div>
              <div className="text-gray-500 text-sm mb-4">per piece (postage only)</div>
              <p className="text-gray-600 mb-6">
                Your own postcard to every door on selected carrier routes. Full creative control.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Your business only</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Choose exact routes</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> No mailing list needed</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Min 200 pieces</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Design available</li>
              </ul>
              <Link href="/quote" className="block text-center bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200">
                Get EDDM Quote
              </Link>
            </div>

            {/* Solo Mailer */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Solo Mailers</h3>
              <div className="text-3xl font-bold text-blue-600 mb-1">Custom</div>
              <div className="text-gray-500 text-sm mb-4">based on quantity & targeting</div>
              <p className="text-gray-600 mb-6">
                Targeted mailings with custom lists. Perfect for specific demographics or past customers.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Targeted mailing lists</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Multiple sizes available</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Variable data printing</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Address verification</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Response tracking</li>
              </ul>
              <Link href="/quote" className="block text-center bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200">
                Get Custom Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section id="areas" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Service Areas</h2>
          <p className="text-center text-gray-600 mb-12">
            Serving all of Monterey County and surrounding areas
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/areas/${city.slug}`}
                className="bg-white border-2 border-gray-100 rounded-xl p-6 hover:border-blue-600 hover:shadow-lg transition-all group"
              >
                <h3 className="font-bold text-lg group-hover:text-blue-600">{city.name}</h3>
                <p className="text-gray-500 text-sm">{city.households} households</p>
                <span className="text-blue-600 text-sm mt-2 inline-block">View routes →</span>
              </Link>
            ))}
          </div>
          <p className="text-center text-gray-500 mt-8">
            Don't see your area? <Link href="/quote" className="text-blue-600 hover:underline">Contact us</Link> — we cover all of California.
          </p>
        </div>
      </section>

      {/* Pricing Preview */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Transparent Pricing</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            No hidden fees. Know exactly what you'll pay before you commit.
          </p>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 font-medium text-gray-700">Service</th>
                  <th className="text-left px-6 py-4 font-medium text-gray-700">Price</th>
                  <th className="text-left px-6 py-4 font-medium text-gray-700">Includes</th>
                  <th className="text-left px-6 py-4 font-medium text-gray-700 hidden md:table-cell">Best For</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-6 py-4 font-medium">Co-op Spot</td>
                  <td className="px-6 py-4 text-blue-600 font-bold">$299-$500</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Design, print, postage</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">Budget-conscious, first timers</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 font-medium">EDDM Postage</td>
                  <td className="px-6 py-4 text-blue-600 font-bold">$0.242-$0.247/pc</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Postage only</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">Full control, larger campaigns</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">EDDM Full Service</td>
                  <td className="px-6 py-4 text-blue-600 font-bold">$0.35-$0.45/pc</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Design, print, postage</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">Hands-off campaigns</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 font-medium">Design Only</td>
                  <td className="px-6 py-4 text-blue-600 font-bold">$75-$200</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Print-ready files</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">DIY mailers</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="text-blue-600 hover:underline font-medium">
              View full pricing calculator →
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What Our Clients Say</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white border rounded-xl p-6">
                <div className="flex items-center gap-1 text-yellow-400 mb-4">
                  {'★★★★★'.split('').map((s, j) => <span key={j}>{s}</span>)}
                </div>
                <p className="text-gray-700 mb-4">"{t.text}"</p>
                <div className="text-sm">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-gray-500">{t.business}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Reach More Customers?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join 850+ Monterey County businesses using direct mail to grow.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/quote" 
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-blue-50"
            >
              Get Your Free Quote
            </Link>
            <Link 
              href="/coop-board" 
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10"
            >
              Browse Co-op Spots
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-white text-xl font-bold mb-4">CaliforniaMailer</div>
              <p className="text-sm">
                Professional direct mail services for Monterey County and all of California.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Services</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/services#coop" className="hover:text-white">Co-op Postcards</Link></li>
                <li><Link href="/services#eddm" className="hover:text-white">EDDM Mailings</Link></li>
                <li><Link href="/services#solo" className="hover:text-white">Solo Mailers</Link></li>
                <li><Link href="/services#design" className="hover:text-white">Design Services</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Areas</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/areas/salinas" className="hover:text-white">Salinas</Link></li>
                <li><Link href="/areas/monterey" className="hover:text-white">Monterey</Link></li>
                <li><Link href="/areas/carmel" className="hover:text-white">Carmel</Link></li>
                <li><Link href="/areas/pacific-grove" className="hover:text-white">Pacific Grove</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>hello@californiamailer.com</li>
                <li>(831) 555-0100</li>
                <li className="pt-2">
                  <Link href="/" className="text-blue-400 hover:text-blue-300">Client Portal Login →</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            © {new Date().getFullYear()} CaliforniaMailer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
