'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function PricingPage() {
  const { user, loading, logout } = useAuth();
  const [calcType, setCalcType] = useState<'eddm' | 'coop'>('eddm');
  
  // EDDM inputs
  const [eddmQuantity, setEddmQuantity] = useState(5000);
  const [eddmPrintCost, setEddmPrintCost] = useState(0.08);
  const [eddmPostage, setEddmPostage] = useState(0.223);
  const [eddmMarkup, setEddmMarkup] = useState(0.05);
  const [eddmShipping, setEddmShipping] = useState(0);
  const [eddmBundleDiscount, setEddmBundleDiscount] = useState(0);

  // Co-op inputs
  const [coopSpots, setCoopSpots] = useState(8);
  const [coopQuantity, setCoopQuantity] = useState(10000);
  const [coopPrintCost, setCoopPrintCost] = useState(0.12);
  const [coopPostage, setCoopPostage] = useState(0.28);
  const [coopPricePerSpot, setCoopPricePerSpot] = useState(350);
  const [coopShipping, setCoopShipping] = useState(0);
  const [coopBundleDiscount, setCoopBundleDiscount] = useState(0);

  // EDDM calculations
  const eddmTotalPrint = eddmQuantity * eddmPrintCost;
  const eddmTotalPostage = eddmQuantity * eddmPostage;
  const eddmTotalMarkup = eddmQuantity * eddmMarkup;
  const eddmSubtotal = eddmTotalPrint + eddmTotalPostage + eddmTotalMarkup + eddmShipping;
  const eddmDiscountAmount = eddmSubtotal * (eddmBundleDiscount / 100);
  const eddmClientPrice = eddmSubtotal - eddmDiscountAmount;
  const eddmTotalCost = eddmTotalPrint + eddmTotalPostage + eddmShipping;
  const eddmProfit = eddmClientPrice - eddmTotalCost;
  const eddmCostPerPiece = eddmClientPrice / eddmQuantity;

  // Co-op calculations
  const coopTotalPrint = coopQuantity * coopPrintCost;
  const coopTotalPostage = coopQuantity * coopPostage;
  const coopTotalCost = coopTotalPrint + coopTotalPostage + coopShipping;
  const coopGrossRevenue = coopSpots * coopPricePerSpot;
  const coopDiscountAmount = coopGrossRevenue * (coopBundleDiscount / 100);
  const coopTotalRevenue = coopGrossRevenue - coopDiscountAmount;
  const coopProfit = coopTotalRevenue - coopTotalCost;
  const coopProfitPerSpot = coopProfit / coopSpots;
  const coopBreakeven = Math.ceil(coopTotalCost / coopPricePerSpot);

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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pricing Calculator</h2>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setCalcType('eddm')}
              className={`px-4 py-2 rounded-lg font-medium ${
                calcType === 'eddm' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              EDDM
            </button>
            <button
              onClick={() => setCalcType('coop')}
              className={`px-4 py-2 rounded-lg font-medium ${
                calcType === 'coop' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              9x12 Co-op
            </button>
          </div>

          {calcType === 'eddm' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium mb-4">EDDM Inputs</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      value={eddmQuantity}
                      onChange={(e) => setEddmQuantity(parseInt(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Print Cost per Piece ($)</label>
                    <input
                      type="number"
                      value={eddmPrintCost}
                      onChange={(e) => setEddmPrintCost(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">EDDM Postage per Piece ($)</label>
                    <input
                      type="number"
                      value={eddmPostage}
                      onChange={(e) => setEddmPostage(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Your Markup per Piece ($)</label>
                    <input
                      type="number"
                      value={eddmMarkup}
                      onChange={(e) => setEddmMarkup(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Shipping Fee ($)</label>
                    <input
                      type="number"
                      value={eddmShipping}
                      onChange={(e) => setEddmShipping(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bundle Discount (%)</label>
                    <input
                      type="number"
                      value={eddmBundleDiscount}
                      onChange={(e) => setEddmBundleDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium mb-4">EDDM Results</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Print Cost</span>
                    <span className="font-medium">${eddmTotalPrint.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Postage</span>
                    <span className="font-medium">${eddmTotalPostage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Your Markup</span>
                    <span className="font-medium">${eddmTotalMarkup.toFixed(2)}</span>
                  </div>
                  {eddmShipping > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">${eddmShipping.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${eddmSubtotal.toFixed(2)}</span>
                  </div>
                  {eddmBundleDiscount > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Bundle Discount ({eddmBundleDiscount}%)</span>
                      <span className="font-medium text-red-600">-${eddmDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b bg-blue-50 px-2 -mx-2 rounded">
                    <span className="font-medium">Client Price</span>
                    <span className="font-bold text-blue-600">${eddmClientPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b bg-green-50 px-2 -mx-2 rounded">
                    <span className="font-medium">Your Profit</span>
                    <span className={`font-bold ${eddmProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${eddmProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Cost per Piece</span>
                    <span className="font-medium">${eddmCostPerPiece.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium mb-4">Co-op Inputs</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Number of Spots</label>
                    <input
                      type="number"
                      value={coopSpots}
                      onChange={(e) => setCoopSpots(parseInt(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Total Quantity</label>
                    <input
                      type="number"
                      value={coopQuantity}
                      onChange={(e) => setCoopQuantity(parseInt(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Print Cost per Piece ($)</label>
                    <input
                      type="number"
                      value={coopPrintCost}
                      onChange={(e) => setCoopPrintCost(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Postage per Piece ($)</label>
                    <input
                      type="number"
                      value={coopPostage}
                      onChange={(e) => setCoopPostage(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price per Spot ($)</label>
                    <input
                      type="number"
                      value={coopPricePerSpot}
                      onChange={(e) => setCoopPricePerSpot(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Shipping Fee ($)</label>
                    <input
                      type="number"
                      value={coopShipping}
                      onChange={(e) => setCoopShipping(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bundle Discount (%)</label>
                    <input
                      type="number"
                      value={coopBundleDiscount}
                      onChange={(e) => setCoopBundleDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium mb-4">Co-op Results</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Print Cost</span>
                    <span className="font-medium">${coopTotalPrint.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Postage</span>
                    <span className="font-medium">${coopTotalPostage.toFixed(2)}</span>
                  </div>
                  {coopShipping > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">${coopShipping.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Cost</span>
                    <span className="font-medium">${coopTotalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Gross Revenue ({coopSpots} spots)</span>
                    <span className="font-medium">${coopGrossRevenue.toFixed(2)}</span>
                  </div>
                  {coopBundleDiscount > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Bundle Discount ({coopBundleDiscount}%)</span>
                      <span className="font-medium text-red-600">-${coopDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b bg-blue-50 px-2 -mx-2 rounded">
                    <span className="font-medium">Total Revenue</span>
                    <span className="font-bold text-blue-600">${coopTotalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b bg-green-50 px-2 -mx-2 rounded">
                    <span className="font-medium">Total Profit</span>
                    <span className={`font-bold ${coopProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${coopProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Profit per Spot</span>
                    <span className={`font-medium ${coopProfitPerSpot >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${coopProfitPerSpot.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Breakeven Spots</span>
                    <span className="font-medium">{coopBreakeven}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
