'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

type CardSize = '4x6' | '6x9' | '6x11' | '9x12' | '8.5x11';
type MailType = 'eddm-retail' | 'eddm-bmeu' | 'eddm-dscf' | 'eddm-nonprofit' | 'first-class-letter' | 'first-class-postcard' | 'marketing-mail';
type ServiceType = 'eddm' | 'coop' | 'solo';

interface CardSizeInfo {
  name: string;
  dimensions: string;
  eddmEligible: boolean;
  printCost: { min: number; max: number };
  description: string;
}

const cardSizes: Record<CardSize, CardSizeInfo> = {
  '4x6': {
    name: '4x6 Postcard',
    dimensions: '4" x 6"',
    eddmEligible: false,
    printCost: { min: 0.05, max: 0.10 },
    description: 'Standard postcard size. Not EDDM eligible (too small).',
  },
  '6x9': {
    name: '6x9 Postcard',
    dimensions: '6" x 9"',
    eddmEligible: false,
    printCost: { min: 0.07, max: 0.12 },
    description: 'Popular size for targeted mailings. Not EDDM eligible.',
  },
  '6x11': {
    name: '6.5x11 Postcard',
    dimensions: '6.5" x 11"',
    eddmEligible: true,
    printCost: { min: 0.08, max: 0.14 },
    description: 'EDDM eligible. Great for co-op with 8-12 advertisers.',
  },
  '9x12': {
    name: '9x12 Postcard',
    dimensions: '9" x 12"',
    eddmEligible: true,
    printCost: { min: 0.10, max: 0.18 },
    description: 'Premium EDDM size. Best for co-op with 10-16 advertisers.',
  },
  '8.5x11': {
    name: '8.5x11 Letter',
    dimensions: '8.5" x 11"',
    eddmEligible: true,
    printCost: { min: 0.12, max: 0.20 },
    description: 'Letter format. EDDM eligible in flat configuration.',
  },
};

const postageRates: Record<MailType, { name: string; rate: number; description: string }> = {
  'eddm-retail': {
    name: 'EDDM Retail',
    rate: 0.247,
    description: 'DIY drop-off at Post Office. Min 200, max 5,000/day per ZIP.',
  },
  'eddm-bmeu': {
    name: 'EDDM BMEU (DDU)',
    rate: 0.247,
    description: 'Business Mail Entry Unit - DDU entry (best rate). No daily limits.',
  },
  'eddm-dscf': {
    name: 'EDDM BMEU (DSCF)',
    rate: 0.253,
    description: 'Business Mail Entry Unit - DSCF entry.',
  },
  'eddm-nonprofit': {
    name: 'EDDM Nonprofit',
    rate: 0.157,
    description: 'For qualified 501(c)(3) organizations. Range: $0.132-$0.181.',
  },
  'first-class-letter': {
    name: 'First Class Letter',
    rate: 0.78,
    description: 'Fastest delivery. Requires mailing list. (Forever stamp rate)',
  },
  'first-class-postcard': {
    name: 'First Class Postcard',
    rate: 0.61,
    description: 'Standard postcard rate. Requires mailing list.',
  },
  'marketing-mail': {
    name: 'Marketing Mail',
    rate: 0.355,
    description: 'Bulk rate with mailing list. Min 200 pieces.',
  },
};

const coopPricing = {
  rural: { min: 199, max: 299, income: 'Under $55K', label: 'Rural' },
  suburban: { min: 300, max: 500, income: '$55K - $100K', label: 'Suburban' },
  premium: { min: 500, max: 800, income: 'Over $100K', label: 'Premium/Affluent' },
};

export default function PricingPage() {
  const { user, loading, logout } = useAuth();
  
  // EDDM Calculator State
  const [eddmQuantity, setEddmQuantity] = useState(5000);
  const [eddmCardSize, setEddmCardSize] = useState<CardSize>('9x12');
  const [eddmMailType, setEddmMailType] = useState<MailType>('eddm-bmeu');
  const [eddmPrintCost, setEddmPrintCost] = useState(0.12);
  const [eddmDesignCost, setEddmDesignCost] = useState(150);
  const [eddmShipping, setEddmShipping] = useState(0);
  const [eddmDiscount, setEddmDiscount] = useState(0);

  // Co-op Calculator State
  const [coopQuantity, setCoopQuantity] = useState(10000);
  const [coopCardSize, setCoopCardSize] = useState<CardSize>('9x12');
  const [coopSpots, setCoopSpots] = useState(10);
  const [coopPricePerSpot, setCoopPricePerSpot] = useState(450);
  const [coopPrintCost, setCoopPrintCost] = useState(0.12);
  const [coopDesignCost, setCoopDesignCost] = useState(250);
  const [coopShipping, setCoopShipping] = useState(75);
  const [coopDiscount, setCoopDiscount] = useState(0);
  const [coopSoldSpots, setCoopSoldSpots] = useState(8);
  const [marketType, setMarketType] = useState<'rural' | 'suburban' | 'premium'>('suburban');

  // Solo Calculator State
  const [soloQuantity, setSoloQuantity] = useState(2500);
  const [soloCardSize, setSoloCardSize] = useState<CardSize>('6x9');
  const [soloMailType, setSoloMailType] = useState<MailType>('marketing-mail');
  const [soloPrintCost, setSoloPrintCost] = useState(0.10);
  const [soloDesignCost, setSoloDesignCost] = useState(200);
  const [soloClientPrice, setSoloClientPrice] = useState(1500);

  // EDDM Calculations
  const eddmPostage = postageRates[eddmMailType].rate;
  const eddmTotalPrint = eddmQuantity * eddmPrintCost;
  const eddmTotalPostage = eddmQuantity * eddmPostage;
  const eddmSubtotal = eddmTotalPrint + eddmTotalPostage + eddmDesignCost + eddmShipping;
  const eddmDiscountAmount = eddmSubtotal * (eddmDiscount / 100);
  const eddmTotal = eddmSubtotal - eddmDiscountAmount;
  const eddmPerPiece = eddmTotal / eddmQuantity;

  // Co-op Calculations
  const coopGrossRevenue = coopSoldSpots * coopPricePerSpot;
  const coopTotalPrint = coopQuantity * coopPrintCost;
  const coopTotalPostage = coopQuantity * postageRates['eddm-bmeu'].rate;
  const coopTotalCost = coopTotalPrint + coopTotalPostage + coopDesignCost + coopShipping;
  const coopDiscountAmount = coopGrossRevenue * (coopDiscount / 100);
  const coopNetRevenue = coopGrossRevenue - coopDiscountAmount;
  const coopProfit = coopNetRevenue - coopTotalCost;
  const coopMargin = coopNetRevenue > 0 ? (coopProfit / coopNetRevenue) * 100 : 0;
  const coopFillRate = (coopSoldSpots / coopSpots) * 100;
  const coopBreakeven = Math.ceil(coopTotalCost / coopPricePerSpot);

  // Solo Calculations
  const soloPostage = postageRates[soloMailType].rate;
  const soloTotalPrint = soloQuantity * soloPrintCost;
  const soloTotalPostage = soloQuantity * soloPostage;
  const soloTotalCost = soloTotalPrint + soloTotalPostage + soloDesignCost;
  const soloProfit = soloClientPrice - soloTotalCost;
  const soloMargin = soloClientPrice > 0 ? (soloProfit / soloClientPrice) * 100 : 0;

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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pricing Calculator</h2>
          <p className="text-gray-500 mb-6">Calculate costs and profits for EDDM, Co-op, and Solo campaigns</p>

          {/* Quick Reference Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Card Sizes Reference */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-bold text-gray-900 mb-3">📐 Card Sizes</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(cardSizes).map(([key, size]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className={size.eddmEligible ? 'text-green-700' : 'text-gray-600'}>
                      {size.eddmEligible ? '✓' : '✗'} {size.name}
                    </span>
                    <span className="text-gray-500">{size.dimensions}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">✓ = EDDM Eligible (min 6.125" x 11")</p>
            </div>

            {/* Postage Rates Reference */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-bold text-gray-900 mb-3">📬 Postage Rates</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(postageRates).map(([key, rate]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-700">{rate.name}</span>
                    <span className="font-medium">${rate.rate.toFixed(3)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Rates as of 2025</p>
            </div>

            {/* Co-op Pricing Reference */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-bold text-gray-900 mb-3">💰 Co-op Slot Pricing</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(coopPricing).map(([key, pricing]) => (
                  <div key={key} className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-700">{pricing.label}</span>
                      <span className="text-xs text-gray-400 ml-1">({pricing.income})</span>
                    </div>
                    <span className="font-medium">${pricing.min}-${pricing.max}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Based on area median household income</p>
            </div>
          </div>

          {/* EDDM Calculator */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-blue-600 mb-4">📬 EDDM Calculator</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={eddmQuantity}
                  onChange={(e) => setEddmQuantity(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Card Size</label>
                <select
                  value={eddmCardSize}
                  onChange={(e) => {
                    const size = e.target.value as CardSize;
                    setEddmCardSize(size);
                    setEddmPrintCost((cardSizes[size].printCost.min + cardSizes[size].printCost.max) / 2);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {Object.entries(cardSizes).filter(([_, s]) => s.eddmEligible).map(([key, size]) => (
                    <option key={key} value={key}>{size.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mail Type</label>
                <select
                  value={eddmMailType}
                  onChange={(e) => setEddmMailType(e.target.value as MailType)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="eddm-retail">EDDM Retail ($0.247)</option>
                  <option value="eddm-bmeu">EDDM BMEU ($0.223)</option>
                  <option value="eddm-nonprofit">EDDM Nonprofit ($0.157)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Print Cost/Piece</label>
                <input
                  type="number"
                  value={eddmPrintCost}
                  onChange={(e) => setEddmPrintCost(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Design Cost</label>
                <input
                  type="number"
                  value={eddmDesignCost}
                  onChange={(e) => setEddmDesignCost(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shipping</label>
                <input
                  type="number"
                  value={eddmShipping}
                  onChange={(e) => setEddmShipping(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Discount %</label>
                <input
                  type="number"
                  value={eddmDiscount}
                  onChange={(e) => setEddmDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-500">Print</div>
                  <div className="text-lg font-bold">${eddmTotalPrint.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Postage</div>
                  <div className="text-lg font-bold">${eddmTotalPostage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Design + Ship</div>
                  <div className="text-lg font-bold">${(eddmDesignCost + eddmShipping).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Cost</div>
                  <div className="text-xl font-bold text-blue-600">${eddmTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Per Piece</div>
                  <div className="text-xl font-bold text-blue-600">${eddmPerPiece.toFixed(3)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Co-op Calculator */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-purple-600 mb-4">🤝 Co-op Calculator</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={coopQuantity}
                  onChange={(e) => setCoopQuantity(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  step="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Card Size</label>
                <select
                  value={coopCardSize}
                  onChange={(e) => {
                    const size = e.target.value as CardSize;
                    setCoopCardSize(size);
                    setCoopPrintCost((cardSizes[size].printCost.min + cardSizes[size].printCost.max) / 2);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {Object.entries(cardSizes).filter(([_, s]) => s.eddmEligible).map(([key, size]) => (
                    <option key={key} value={key}>{size.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Spots</label>
                <input
                  type="number"
                  value={coopSpots}
                  onChange={(e) => setCoopSpots(parseInt(e.target.value) || 1)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Market Type</label>
                <select
                  value={marketType}
                  onChange={(e) => {
                    const type = e.target.value as 'rural' | 'suburban' | 'premium';
                    setMarketType(type);
                    setCoopPricePerSpot((coopPricing[type].min + coopPricing[type].max) / 2);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="rural">Rural ($199-$299)</option>
                  <option value="suburban">Suburban ($300-$500)</option>
                  <option value="premium">Premium ($500-$800)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price/Spot</label>
                <input
                  type="number"
                  value={coopPricePerSpot}
                  onChange={(e) => setCoopPricePerSpot(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Spots Sold</label>
                <input
                  type="number"
                  value={coopSoldSpots}
                  onChange={(e) => setCoopSoldSpots(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  max={coopSpots}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Print Cost/Piece</label>
                <input
                  type="number"
                  value={coopPrintCost}
                  onChange={(e) => setCoopPrintCost(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Design Cost</label>
                <input
                  type="number"
                  value={coopDesignCost}
                  onChange={(e) => setCoopDesignCost(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shipping</label>
                <input
                  type="number"
                  value={coopShipping}
                  onChange={(e) => setCoopShipping(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bundle Discount %</label>
                <input
                  type="number"
                  value={coopDiscount}
                  onChange={(e) => setCoopDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            {/* Fill Rate Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Fill Rate: {coopSoldSpots}/{coopSpots} spots</span>
                <span className={coopFillRate >= 100 ? 'text-green-600' : coopFillRate >= 75 ? 'text-yellow-600' : 'text-red-600'}>
                  {coopFillRate.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${coopFillRate >= 100 ? 'bg-green-500' : coopFillRate >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, coopFillRate)}%` }}
                />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-500">Gross Revenue</div>
                  <div className="text-lg font-bold">${coopGrossRevenue.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Cost</div>
                  <div className="text-lg font-bold">${coopTotalCost.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Net Profit</div>
                  <div className={`text-xl font-bold ${coopProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${coopProfit.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Margin</div>
                  <div className={`text-xl font-bold ${coopMargin >= 25 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {coopMargin.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Breakeven</div>
                  <div className="text-lg font-bold">{coopBreakeven} spots</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Per Home</div>
                  <div className="text-lg font-bold">${(coopTotalCost / coopQuantity).toFixed(3)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Solo Calculator */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-orange-600 mb-4">🎯 Solo Mailer Calculator</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={soloQuantity}
                  onChange={(e) => setSoloQuantity(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  step="500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Card Size</label>
                <select
                  value={soloCardSize}
                  onChange={(e) => {
                    const size = e.target.value as CardSize;
                    setSoloCardSize(size);
                    setSoloPrintCost((cardSizes[size].printCost.min + cardSizes[size].printCost.max) / 2);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {Object.entries(cardSizes).map(([key, size]) => (
                    <option key={key} value={key}>{size.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mail Type</label>
                <select
                  value={soloMailType}
                  onChange={(e) => setSoloMailType(e.target.value as MailType)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {Object.entries(postageRates).map(([key, rate]) => (
                    <option key={key} value={key}>{rate.name} (${rate.rate})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client Price</label>
                <input
                  type="number"
                  value={soloClientPrice}
                  onChange={(e) => setSoloClientPrice(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Print Cost/Piece</label>
                <input
                  type="number"
                  value={soloPrintCost}
                  onChange={(e) => setSoloPrintCost(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Design Cost</label>
                <input
                  type="number"
                  value={soloDesignCost}
                  onChange={(e) => setSoloDesignCost(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-500">Print Cost</div>
                  <div className="text-lg font-bold">${soloTotalPrint.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Postage</div>
                  <div className="text-lg font-bold">${soloTotalPostage.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Cost</div>
                  <div className="text-lg font-bold">${soloTotalCost.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Profit</div>
                  <div className={`text-xl font-bold ${soloProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${soloProfit.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Margin</div>
                  <div className={`text-xl font-bold ${soloMargin >= 25 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {soloMargin.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reference Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">📋 Quick Reference</h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-yellow-700">
              <div>
                <strong>EDDM Requirements:</strong>
                <ul className="list-disc ml-4 mt-1">
                  <li>Min size: 6.125" x 11" or 4.25" x 6" (letter)</li>
                  <li>Max size: 12" x 15"</li>
                  <li>Min 200 pieces per mailing</li>
                  <li>Max 5,000 pieces/day/ZIP (Retail)</li>
                </ul>
              </div>
              <div>
                <strong>Typical Print Costs:</strong>
                <ul className="list-disc ml-4 mt-1">
                  <li>6.5x11: $0.08-$0.14/pc</li>
                  <li>9x12: $0.10-$0.18/pc</li>
                  <li>Volume 10K+: Better rates</li>
                </ul>
              </div>
              <div>
                <strong>Target Margins:</strong>
                <ul className="list-disc ml-4 mt-1">
                  <li>Co-op: 25-40%</li>
                  <li>Solo: 30-50%</li>
                  <li>EDDM service: 20-30%</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
