'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

interface CarrierRoute {
  zip: string;
  routeId: string;
  city: string;
  state: string;
  residential: number;
  business: number;
  total: number;
  poBoxes: number;
}

export default function EDDMPage() {
  const { user, loading, logout } = useAuth();
  const [zipCode, setZipCode] = useState('');
  const [routes, setRoutes] = useState<CarrierRoute[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    setSearching(true);
    setError('');
    setRoutes([]);
    setSelectedRoutes(new Set());

    try {
      // Note: USPS doesn't have a free public API for EDDM data
      // This uses a mock/demo data approach
      // For production, you'd need to integrate with USPS Web Tools or a third-party service
      
      const response = await fetch(`/api/eddm-lookup?zip=${zipCode}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setRoutes(data.routes || []);
      }
    } catch (err) {
      setError('Failed to lookup carrier routes. Please try again.');
    }

    setSearching(false);
  }

  function toggleRoute(routeId: string) {
    const newSelected = new Set(selectedRoutes);
    if (newSelected.has(routeId)) {
      newSelected.delete(routeId);
    } else {
      newSelected.add(routeId);
    }
    setSelectedRoutes(newSelected);
  }

  function selectAll() {
    if (selectedRoutes.size === routes.length) {
      setSelectedRoutes(new Set());
    } else {
      setSelectedRoutes(new Set(routes.map(r => r.routeId)));
    }
  }

  const selectedTotal = routes
    .filter(r => selectedRoutes.has(r.routeId))
    .reduce((sum, r) => sum + r.residential, 0);

  const selectedBusiness = routes
    .filter(r => selectedRoutes.has(r.routeId))
    .reduce((sum, r) => sum + r.business, 0);

  // EDDM pricing calculation
  const eddmPostage = 0.223; // Current EDDM retail rate
  const estimatedPostage = selectedTotal * eddmPostage;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center"><p>Please sign in</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1">
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">CaliforniaMailer</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">{user.email}</span>
              <button onClick={logout} className="text-gray-500 hover:text-gray-700">Sign out</button>
            </div>
          </div>
        </header>
        <main className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">EDDM Route Lookup</h2>
          <p className="text-gray-500 mb-6">Find carrier routes and household counts for Every Door Direct Mail</p>

          {/* Search Form */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <form onSubmit={handleSearch} className="flex gap-4 items-end">
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full border rounded-lg px-4 py-2 text-lg"
                  placeholder="93908"
                  maxLength={5}
                />
              </div>
              <button
                type="submit"
                disabled={searching || zipCode.length !== 5}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {searching ? 'Searching...' : 'Search Routes'}
              </button>
            </form>
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>

          {/* Selected Summary */}
          {routes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{selectedRoutes.size}</span> routes selected
                  <span className="mx-3">•</span>
                  <span className="font-medium">{selectedTotal.toLocaleString()}</span> residential
                  <span className="mx-3">•</span>
                  <span className="font-medium">{selectedBusiness.toLocaleString()}</span> business
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Est. EDDM Postage</div>
                  <div className="text-xl font-bold text-blue-600">${estimatedPostage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          )}

          {/* Routes Table */}
          {routes.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedRoutes.size === routes.length}
                        onChange={selectAll}
                        className="mr-2"
                      />
                      Select All
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Route</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">City</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Residential</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Business</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">PO Boxes</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {routes.map((route) => (
                    <tr 
                      key={route.routeId}
                      className={selectedRoutes.has(route.routeId) ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRoutes.has(route.routeId)}
                          onChange={() => toggleRoute(route.routeId)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{route.routeId}</td>
                      <td className="px-4 py-3">{route.city}, {route.state}</td>
                      <td className="px-4 py-3 text-right">{route.residential.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{route.business.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{route.poBoxes.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium">{route.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-medium">Total ({routes.length} routes)</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {routes.reduce((sum, r) => sum + r.residential, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {routes.reduce((sum, r) => sum + r.business, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {routes.reduce((sum, r) => sum + r.poBoxes, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {routes.reduce((sum, r) => sum + r.total, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">About EDDM</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Current EDDM Retail postage rate: $0.223 per piece</li>
              <li>• Minimum 200 pieces, maximum 5,000 pieces per ZIP per day</li>
              <li>• Mail pieces must be between 6.125" x 11" and 12" x 15"</li>
              <li>• No mailing list required - reaches every address on selected routes</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
