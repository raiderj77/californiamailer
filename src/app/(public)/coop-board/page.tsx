'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAvailableCoopSpots, CoopSpot } from '@/lib/firestore';

export default function CoopBoardPage() {
  const [spots, setSpots] = useState<CoopSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  useEffect(() => {
    loadSpots();
  }, []);

  async function loadSpots() {
    try {
      const data = await getAvailableCoopSpots();
      setSpots(data);
    } catch (error) {
      console.error('Error loading spots:', error);
    } finally {
      setLoading(false);
    }
  }

  const cities = [...new Set(spots.map(s => s.city))].sort();
  const months = [...new Set(spots.map(s => {
    const date = new Date(s.mailDate);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }))].sort();

  const filteredSpots = spots.filter(spot => {
    const matchCity = selectedCity === 'all' || spot.city === selectedCity;
    const spotMonth = new Date(spot.mailDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const matchMonth = selectedMonth === 'all' || spotMonth === selectedMonth;
    return matchCity && matchMonth;
  });

  const groupedSpots = filteredSpots.reduce((acc, spot) => {
    if (!acc[spot.campaignId]) {
      acc[spot.campaignId] = {
        campaignName: spot.campaignName,
        territory: spot.territory || '',
        city: spot.city,
        mailDate: spot.mailDate,
        households: spot.households,
        spots: []
      };
    }
    acc[spot.campaignId].spots.push(spot);
    return acc;
  }, {} as Record<string, { campaignName: string; territory: string; city: string; mailDate: string; households: number; spots: CoopSpot[] }>);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold">CaliforniaMailer</Link>
          <nav className="hidden md:flex gap-6">
            <Link href="/home" className="hover:text-blue-200">Home</Link>
            <Link href="/services" className="hover:text-blue-200">Services</Link>
            <Link href="/coop-board" className="hover:text-blue-200 font-semibold">Co-op Board</Link>
            <Link href="/quote" className="hover:text-blue-200">Get Quote</Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-r from-green-600 to-green-800 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Co-op Postcard Board</h1>
          <p className="text-xl text-green-100 mb-6">Reserve your spot on upcoming 9x12 co-op mailings in Monterey County</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="bg-white/20 rounded-full px-4 py-2">✓ 10,000+ households per mailing</div>
            <div className="bg-white/20 rounded-full px-4 py-2">✓ Category exclusivity</div>
            <div className="bg-white/20 rounded-full px-4 py-2">✓ Professional design included</div>
          </div>
        </div>
      </section>

      <section className="bg-white border-b py-4 px-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-center">
          <div className="font-semibold text-gray-700">Filter:</div>
          <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="border rounded-lg px-4 py-2 bg-white">
            <option value="all">All Cities</option>
            {cities.map(city => (<option key={city} value={city}>{city}</option>))}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border rounded-lg px-4 py-2 bg-white">
            <option value="all">All Months</option>
            {months.map(month => (<option key={month} value={month}>{month}</option>))}
          </select>
          <div className="ml-auto text-sm text-gray-500">{filteredSpots.length} spot{filteredSpots.length !== 1 ? 's' : ''} available</div>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading available spots...</p>
            </div>
          ) : Object.keys(groupedSpots).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2">No spots available</h3>
              <p className="text-gray-500 mb-6">Check back soon for new co-op mailings!</p>
              <Link href="/quote" className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700">Request Custom Quote</Link>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSpots).map(([campaignId, campaign]) => (
                <div key={campaignId} className="bg-white rounded-xl border overflow-hidden">
                  <div className="bg-gray-50 border-b px-6 py-4">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{campaign.campaignName}</h2>
                        <p className="text-gray-600">{campaign.territory} • {campaign.city}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Mail Date</div>
                        <div className="font-semibold text-green-600">{formatDate(campaign.mailDate)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                      <span>📬 {campaign.households.toLocaleString()} households</span>
                      <span>📋 {campaign.spots.length} spot{campaign.spots.length !== 1 ? 's' : ''} available</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {campaign.spots.map(spot => (
                        <div key={spot.id} className="border-2 border-dashed border-green-300 rounded-xl p-4 hover:border-green-500 hover:bg-green-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="text-sm text-gray-500">Spot #{spot.spotNumber}</div>
                              {spot.category && (<div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded mt-1">{spot.category} reserved</div>)}
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">${spot.price}</div>
                            </div>
                          </div>
                          <Link href={`/quote?type=coop&spot=${spot.id}&campaign=${campaignId}`} className="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 rounded-lg font-semibold transition-colors">Reserve This Spot</Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-12 px-4 border-t">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">How Co-op Mailings Work</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">1</div>
              <h3 className="font-semibold mb-1">Reserve</h3>
              <p className="text-sm text-gray-600">Pick your spot and submit your info</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">2</div>
              <h3 className="font-semibold mb-1">Design</h3>
              <p className="text-sm text-gray-600">We create your ad (or use yours)</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">3</div>
              <h3 className="font-semibold mb-1">Approve</h3>
              <p className="text-sm text-gray-600">Review and approve your proof</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">4</div>
              <h3 className="font-semibold mb-1">Mail</h3>
              <p className="text-sm text-gray-600">Your ad reaches 10,000+ homes</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-green-600 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Don&apos;t See Your Area?</h2>
          <p className="text-green-100 mb-6">We can set up a custom co-op mailing for any area in Monterey County</p>
          <Link href="/quote?type=custom-coop" className="inline-block bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors">Request Custom Co-op</Link>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm">© {new Date().getFullYear()} CaliforniaMailer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
