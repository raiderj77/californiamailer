'use client';

import Link from 'next/link';
import { useState } from 'react';

interface CoopCampaign {
  id: string;
  name: string;
  city: string;
  neighborhood: string;
  mailDate: string;
  quantity: number;
  totalSpots: number;
  soldSpots: number;
  pricePerSpot: number;
  cardSize: string;
  status: 'booking' | 'filling' | 'almost-full' | 'full' | 'printing' | 'mailed';
  takenCategories: string[];
}

// Demo data - in production this would come from Firestore
const campaigns: CoopCampaign[] = [
  {
    id: 'sal-48',
    name: 'Salinas #48',
    city: 'Salinas',
    neighborhood: 'Creekbridge / Santa Rita',
    mailDate: '2026-02-15',
    quantity: 12500,
    totalSpots: 10,
    soldSpots: 6,
    pricePerSpot: 399,
    cardSize: '9x12',
    status: 'filling',
    takenCategories: ['HVAC', 'Plumbing', 'Roofing', 'Real Estate', 'Dental', 'Pizza'],
  },
  {
    id: 'mon-22',
    name: 'Monterey #22',
    city: 'Monterey',
    neighborhood: 'Del Monte / New Monterey',
    mailDate: '2026-02-20',
    quantity: 8200,
    totalSpots: 10,
    soldSpots: 8,
    pricePerSpot: 449,
    cardSize: '9x12',
    status: 'almost-full',
    takenCategories: ['HVAC', 'Plumbing', 'Electrician', 'Real Estate', 'Restaurant', 'Gym', 'Salon', 'Auto Repair'],
  },
  {
    id: 'car-13',
    name: 'Carmel Valley #13',
    city: 'Carmel Valley',
    neighborhood: 'Carmel Valley Village',
    mailDate: '2026-02-28',
    quantity: 6800,
    totalSpots: 8,
    soldSpots: 3,
    pricePerSpot: 549,
    cardSize: '9x12',
    status: 'booking',
    takenCategories: ['Real Estate', 'Landscaping', 'Wine Shop'],
  },
  {
    id: 'pg-09',
    name: 'Pacific Grove #9',
    city: 'Pacific Grove',
    neighborhood: 'Downtown / Asilomar',
    mailDate: '2026-03-01',
    quantity: 7500,
    totalSpots: 10,
    soldSpots: 4,
    pricePerSpot: 425,
    cardSize: '9x12',
    status: 'filling',
    takenCategories: ['Restaurant', 'Yoga Studio', 'Pet Store', 'Bakery'],
  },
  {
    id: 'sea-15',
    name: 'Seaside #15',
    city: 'Seaside',
    neighborhood: 'Broadway / Fremont',
    mailDate: '2026-03-10',
    quantity: 9200,
    totalSpots: 10,
    soldSpots: 2,
    pricePerSpot: 349,
    cardSize: '9x12',
    status: 'booking',
    takenCategories: ['Auto Repair', 'Tax Service'],
  },
  {
    id: 'sal-49',
    name: 'Salinas #49',
    city: 'Salinas',
    neighborhood: 'North Salinas / Harden Ranch',
    mailDate: '2026-03-15',
    quantity: 14000,
    totalSpots: 12,
    soldSpots: 0,
    pricePerSpot: 379,
    cardSize: '9x12',
    status: 'booking',
    takenCategories: [],
  },
];

const allCategories = [
  'HVAC', 'Plumbing', 'Electrician', 'Roofing', 'Landscaping', 'Pest Control',
  'Real Estate', 'Mortgage', 'Insurance', 'Financial Advisor',
  'Restaurant', 'Pizza', 'Coffee Shop', 'Bakery', 'Catering',
  'Dental', 'Chiropractor', 'Medical', 'Veterinarian', 'Pharmacy',
  'Gym', 'Yoga Studio', 'Salon', 'Spa', 'Barber',
  'Auto Repair', 'Car Wash', 'Tire Shop',
  'Attorney', 'Accountant', 'Tax Service',
  'Pet Store', 'Groomer', 'Daycare',
  'Other',
];

export default function CoopBoardPage() {
  const [cityFilter, setCityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<CoopCampaign | null>(null);

  const filteredCampaigns = campaigns.filter((c) => {
    if (cityFilter !== 'all' && c.city !== cityFilter) return false;
    if (categoryFilter && c.takenCategories.includes(categoryFilter)) return false;
    if (c.status === 'full' || c.status === 'printing' || c.status === 'mailed') return false;
    return true;
  });

  const getStatusBadge = (status: CoopCampaign['status'], soldSpots: number, totalSpots: number) => {
    const fillRate = (soldSpots / totalSpots) * 100;
    
    if (status === 'full') return <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs">Full</span>;
    if (status === 'printing') return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">Printing</span>;
    if (status === 'mailed') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Mailed</span>;
    if (fillRate >= 80) return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Almost Full!</span>;
    if (fillRate >= 50) return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">Filling Fast</span>;
    return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Booking Now</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold text-blue-600">CaliforniaMailer</Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/services" className="text-gray-600 hover:text-gray-900">Services</Link>
            <Link href="/home#areas" className="text-gray-600 hover:text-gray-900">Areas</Link>
            <Link href="/quote" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Get a Quote</Link>
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">Client Login</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Co-op Postcard Board</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Reserve your spot on an upcoming community postcard. Each card goes to thousands of homes 
            with only ONE business per category — no competitors!
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-8 flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Filter by City</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="all">All Cities</option>
              <option value="Salinas">Salinas</option>
              <option value="Monterey">Monterey</option>
              <option value="Carmel Valley">Carmel Valley</option>
              <option value="Pacific Grove">Pacific Grove</option>
              <option value="Seaside">Seaside</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Your Business Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Show all campaigns</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          {categoryFilter && (
            <div className="text-sm text-gray-500 ml-auto">
              Showing campaigns with <span className="font-medium text-green-600">{categoryFilter}</span> spot available
            </div>
          )}
        </div>

        {/* Campaign Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign) => {
            const spotsLeft = campaign.totalSpots - campaign.soldSpots;
            const fillRate = (campaign.soldSpots / campaign.totalSpots) * 100;
            const costPerHome = (campaign.pricePerSpot / campaign.quantity * campaign.totalSpots).toFixed(3);

            return (
              <div
                key={campaign.id}
                className="bg-white rounded-xl border hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{campaign.name}</h3>
                      <p className="text-blue-100 text-sm">{campaign.neighborhood}</p>
                    </div>
                    {getStatusBadge(campaign.status, campaign.soldSpots, campaign.totalSpots)}
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-gray-900">{campaign.quantity.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Homes</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-green-600">{spotsLeft}</div>
                      <div className="text-xs text-gray-500">Spots Left</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-blue-600">${campaign.pricePerSpot}</div>
                      <div className="text-xs text-gray-500">Per Spot</div>
                    </div>
                  </div>

                  {/* Fill Rate Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{campaign.soldSpots} of {campaign.totalSpots} spots sold</span>
                      <span>{fillRate.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          fillRate >= 80 ? 'bg-red-500' : fillRate >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${fillRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mail Date:</span>
                      <span className="font-medium">{formatDate(campaign.mailDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Card Size:</span>
                      <span className="font-medium">{campaign.cardSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cost per Home:</span>
                      <span className="font-medium text-green-600">${costPerHome}</span>
                    </div>
                  </div>

                  {/* Taken Categories */}
                  {campaign.takenCategories.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 mb-2">Categories Taken:</div>
                      <div className="flex flex-wrap gap-1">
                        {campaign.takenCategories.map((cat) => (
                          <span key={cat} className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Reserve a Spot
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCampaigns.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📭</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">No Available Spots</h3>
            <p className="text-gray-500 mb-4">
              {categoryFilter 
                ? `All campaigns currently have a ${categoryFilter} advertiser.`
                : 'No campaigns match your filters.'}
            </p>
            <Link href="/quote" className="text-blue-600 hover:underline">
              Request a custom campaign →
            </Link>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4">How Co-op Postcards Work</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-medium mb-1">📍 Exclusive Categories</div>
              <p className="text-gray-600">Only ONE business per category on each card. No competitors!</p>
            </div>
            <div>
              <div className="font-medium mb-1">💰 All-Inclusive Price</div>
              <p className="text-gray-600">Design, printing, and postage included. No hidden fees.</p>
            </div>
            <div>
              <div className="font-medium mb-1">📬 Every Door</div>
              <p className="text-gray-600">Reaches EVERY household on selected routes via USPS EDDM.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">Reserve Your Spot</h3>
                  <p className="text-gray-500">{selectedCampaign.name} - {selectedCampaign.neighborhood}</p>
                </div>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Homes Reached:</span>
                    <span className="font-medium ml-2">{selectedCampaign.quantity.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Mail Date:</span>
                    <span className="font-medium ml-2">{formatDate(selectedCampaign.mailDate)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Spot Price:</span>
                    <span className="font-bold text-blue-600 ml-2">${selectedCampaign.pricePerSpot}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Spots Left:</span>
                    <span className="font-medium ml-2">{selectedCampaign.totalSpots - selectedCampaign.soldSpots}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Categories Already Taken:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCampaign.takenCategories.length > 0 ? (
                    selectedCampaign.takenCategories.map((cat) => (
                      <span key={cat} className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-green-600 text-sm">All categories available!</span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Link
                  href={`/quote?campaign=${selectedCampaign.id}&price=${selectedCampaign.pricePerSpot}`}
                  className="block w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 text-center"
                >
                  Continue to Reservation →
                </Link>
                <p className="text-center text-xs text-gray-500">
                  You'll provide your business info and select your category on the next page.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm">
          <p>© {new Date().getFullYear()} CaliforniaMailer. All rights reserved.</p>
          <p className="mt-2">
            <Link href="/home" className="hover:text-white">Home</Link>
            <span className="mx-2">•</span>
            <Link href="/quote" className="hover:text-white">Get a Quote</Link>
            <span className="mx-2">•</span>
            <Link href="/" className="hover:text-white">Client Login</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
