import Link from 'next/link';

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold">
            CaliforniaMailer
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href="/home" className="hover:text-blue-200">Home</Link>
            <Link href="/services" className="hover:text-blue-200 font-semibold">Services</Link>
            <Link href="/coop-board" className="hover:text-blue-200">Co-op Board</Link>
            <Link href="/quote" className="hover:text-blue-200">Get Quote</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Services</h1>
          <p className="text-xl text-blue-100">
            Professional direct mail solutions for Monterey County businesses
          </p>
        </div>
      </section>

      {/* Main Services */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* EDDM */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Every Door Direct Mail (EDDM)</h2>
              <p className="text-gray-600 mb-6">
                Reach every household on specific postal routes without needing a mailing list. 
                Perfect for local businesses wanting to saturate their target neighborhoods.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>No mailing list required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Target by ZIP code and carrier route</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>As low as $0.242/piece with BMEU rates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>6.5" x 9" to 12" x 15" sizes available</span>
                </li>
              </ul>
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-blue-600 font-semibold">Starting at</div>
                <div className="text-3xl font-bold text-blue-700">$0.242<span className="text-lg">/piece</span></div>
                <div className="text-sm text-blue-600">BMEU rate + printing</div>
              </div>
              <Link 
                href="/quote?service=eddm" 
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                Get EDDM Quote
              </Link>
            </div>

            {/* Co-op Postcards */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-4xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">9x12 Co-op Postcards</h2>
              <p className="text-gray-600 mb-6">
                Share a large-format postcard with other non-competing businesses. 
                Get the impact of a big mailer at a fraction of the cost.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Share costs with 8-16 advertisers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Premium 9x12 full-color postcards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>10,000+ households per mailing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Exclusive category protection</span>
                </li>
              </ul>
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-green-600 font-semibold">Starting at</div>
                <div className="text-3xl font-bold text-green-700">$399<span className="text-lg">/spot</span></div>
                <div className="text-sm text-green-600">10,000 households</div>
              </div>
              <Link 
                href="/coop-board" 
                className="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                View Available Spots
              </Link>
            </div>

            {/* Solo Mailers */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-4xl mb-4">💌</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Solo Direct Mail</h2>
              <p className="text-gray-600 mb-6">
                Your message, your mailer, your audience. Full control over design, 
                timing, and targeting with your own mailing list.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Postcards, letters, and flyers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Use your own mailing list</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>First Class or Marketing Mail rates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Variable data printing available</span>
                </li>
              </ul>
              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-purple-600 font-semibold">Starting at</div>
                <div className="text-3xl font-bold text-purple-700">$0.35<span className="text-lg">/piece</span></div>
                <div className="text-sm text-purple-600">Marketing Mail rate + printing</div>
              </div>
              <Link 
                href="/quote?service=solo" 
                className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                Get Solo Mail Quote
              </Link>
            </div>

            {/* Design Services */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-4xl mb-4">🎨</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Design Services</h2>
              <p className="text-gray-600 mb-6">
                Professional graphic design for your direct mail pieces. 
                We create eye-catching designs that get results.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Professional graphic designers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Unlimited revisions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Print-ready files included</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>48-hour turnaround available</span>
                </li>
              </ul>
              <div className="bg-orange-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-orange-600 font-semibold">Starting at</div>
                <div className="text-3xl font-bold text-orange-700">$149<span className="text-lg">/design</span></div>
                <div className="text-sm text-orange-600">Single-sided postcard</div>
              </div>
              <Link 
                href="/quote?service=design" 
                className="block w-full bg-orange-600 hover:bg-orange-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                Get Design Quote
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
              <h3 className="font-semibold mb-2">Get a Quote</h3>
              <p className="text-gray-600 text-sm">Tell us about your campaign and target area</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
              <h3 className="font-semibold mb-2">Approve Design</h3>
              <p className="text-gray-600 text-sm">Review and approve your mail piece</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
              <h3 className="font-semibold mb-2">We Print & Mail</h3>
              <p className="text-gray-600 text-sm">Professional printing and postal processing</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">4</div>
              <h3 className="font-semibold mb-2">Track Results</h3>
              <p className="text-gray-600 text-sm">Monitor delivery and measure ROI</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Current USPS Rates</h2>
          <p className="text-gray-600 text-center mb-8">Updated January 2026</p>
          
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold">Mail Type</th>
                  <th className="text-right py-4 px-6 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-4 px-6">
                    <div className="font-medium">EDDM Retail</div>
                    <div className="text-sm text-gray-500">Post office drop-off, 5,000/day limit</div>
                  </td>
                  <td className="py-4 px-6 text-right font-semibold">$0.247/piece</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">
                    <div className="font-medium">EDDM BMEU (DDU)</div>
                    <div className="text-sm text-gray-500">Best rate, no daily limits</div>
                  </td>
                  <td className="py-4 px-6 text-right font-semibold text-green-600">$0.242/piece</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">
                    <div className="font-medium">EDDM BMEU (DSCF)</div>
                    <div className="text-sm text-gray-500">Sectional center facility entry</div>
                  </td>
                  <td className="py-4 px-6 text-right font-semibold">$0.253/piece</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">
                    <div className="font-medium">First Class Postcard</div>
                    <div className="text-sm text-gray-500">Fastest delivery</div>
                  </td>
                  <td className="py-4 px-6 text-right font-semibold">$0.61/piece</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">
                    <div className="font-medium">First Class Letter</div>
                    <div className="text-sm text-gray-500">Forever stamp rate</div>
                  </td>
                  <td className="py-4 px-6 text-right font-semibold">$0.78/piece</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">
                    <div className="font-medium">Marketing Mail</div>
                    <div className="text-sm text-gray-500">Bulk rate, 200+ pieces</div>
                  </td>
                  <td className="py-4 px-6 text-right font-semibold">$0.355+/piece</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="text-center mt-8">
            <Link 
              href="/pricing" 
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Use our Pricing Calculator →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 text-white py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-8">
            Get a free quote for your next direct mail campaign
          </p>
          <Link 
            href="/quote" 
            className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors"
          >
            Get Your Free Quote
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-white font-bold text-xl mb-4">CaliforniaMailer</div>
              <p className="text-sm">Professional direct mail services for Monterey County businesses.</p>
            </div>
            <div>
              <div className="font-semibold text-white mb-4">Services</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/services" className="hover:text-white">All Services</Link></li>
                <li><Link href="/quote?service=eddm" className="hover:text-white">EDDM</Link></li>
                <li><Link href="/coop-board" className="hover:text-white">Co-op Postcards</Link></li>
                <li><Link href="/quote?service=solo" className="hover:text-white">Solo Mail</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-4">Areas</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/areas/salinas" className="hover:text-white">Salinas</Link></li>
                <li><Link href="/areas/monterey" className="hover:text-white">Monterey</Link></li>
                <li><Link href="/areas/carmel" className="hover:text-white">Carmel</Link></li>
                <li><Link href="/areas/pacific-grove" className="hover:text-white">Pacific Grove</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-4">Tools</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/pricing" className="hover:text-white">Pricing Calculator</Link></li>
                <li><Link href="/eddm" className="hover:text-white">EDDM Lookup</Link></li>
                <li><Link href="/quote" className="hover:text-white">Get Quote</Link></li>
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
