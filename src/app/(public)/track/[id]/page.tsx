'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getCampaign, getCampaignTracking, Campaign, CampaignTracking } from '@/lib/firestore';

const statusSteps = [
  { key: 'design', label: 'Design', icon: '🎨' },
  { key: 'proof', label: 'Proof Review', icon: '📋' },
  { key: 'approved', label: 'Approved', icon: '✅' },
  { key: 'printing', label: 'Printing', icon: '🖨️' },
  { key: 'shipping', label: 'Shipping', icon: '📦' },
  { key: 'delivered', label: 'At Post Office', icon: '🏤' },
  { key: 'in-homes', label: 'In Homes', icon: '🏠' },
];

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tracking, setTracking] = useState<CampaignTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
      const campaignData = await getCampaign(id);
      if (!campaignData) { setError('Campaign not found'); setLoading(false); return; }
      setCampaign(campaignData);
      const trackingData = await getCampaignTracking(id);
      setTracking(trackingData);
    } catch (err) { console.error('Error:', err); setError('Error loading data'); } 
    finally { setLoading(false); }
  }

  const currentStep = tracking ? statusSteps.findIndex(s => s.key === tracking.status) : 0;
  const isComplete = tracking?.status === 'in-homes';

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (error || !campaign) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center"><div className="text-6xl mb-4">🔍</div><h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1><p className="text-gray-500 mb-6">ID: {id}</p><Link href="/home" className="text-blue-600">Return Home</Link></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white"><div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center"><Link href="/home" className="text-xl font-bold">CaliforniaMailer</Link><span className="text-blue-200 text-sm">Campaign Tracker</span></div></header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border p-6 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div><div className="text-sm text-gray-500">Campaign</div><h1 className="text-2xl font-bold">{campaign.name}</h1><p className="text-gray-600">{campaign.territoryName}</p></div>
            <div className="text-right"><div className="text-sm text-gray-500">ID</div><div className="font-mono bg-gray-100 px-3 py-1 rounded">{id}</div></div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-sm text-gray-500">Type</div><div className="font-semibold capitalize">{campaign.type}</div></div>
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-sm text-gray-500">Quantity</div><div className="font-semibold">{campaign.quantity?.toLocaleString()}</div></div>
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-sm text-gray-500">Mail Date</div><div className="font-semibold">{campaign.mailDate ? new Date(campaign.mailDate).toLocaleDateString() : 'TBD'}</div></div>
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-sm text-gray-500">Status</div><div className={`font-semibold ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>{isComplete ? 'Complete' : 'In Progress'}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-6">Progress</h2>
          <div className="relative mb-8">
            <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded"></div>
            <div className="absolute top-6 left-0 h-1 bg-green-500 rounded transition-all" style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}></div>
            <div className="relative flex justify-between">
              {statusSteps.map((step, idx) => (
                <div key={step.key} className="flex flex-col items-center" style={{ width: '14%' }}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl z-10 ${idx < currentStep ? 'bg-green-500 text-white' : idx === currentStep ? 'bg-blue-500 text-white ring-4 ring-blue-200' : 'bg-gray-200 text-gray-400'}`}>{idx < currentStep ? '✓' : step.icon}</div>
                  <div className={`mt-2 text-xs text-center ${idx === currentStep ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>{step.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`rounded-lg p-4 ${isComplete ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{statusSteps[currentStep >= 0 ? currentStep : 0]?.icon}</span>
              <div>
                <div className={`font-semibold ${isComplete ? 'text-green-700' : 'text-blue-700'}`}>{isComplete ? 'Delivery Complete!' : `Currently: ${statusSteps[currentStep >= 0 ? currentStep : 0]?.label}`}</div>
                <div className={`text-sm ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>{isComplete ? 'Your mailers have been delivered.' : 'Your campaign is being processed.'}</div>
              </div>
            </div>
          </div>
        </div>

        {tracking?.statusHistory && tracking.statusHistory.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-6">Timeline</h2>
            <div className="space-y-4">
              {[...tracking.statusHistory].reverse().map((event, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 pb-4 border-b last:border-0">
                    <div className="flex justify-between"><div className="font-medium capitalize">{statusSteps.find(s => s.key === event.status)?.label || event.status}</div><div className="text-sm text-gray-500">{new Date(event.date).toLocaleString()}</div></div>
                    {event.note && <div className="text-sm text-gray-600 mt-1">{event.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center"><p className="text-gray-500 text-sm mb-4">Questions?</p><Link href="/quote" className="text-blue-600 font-semibold">Contact Us →</Link></div>
      </main>
      <footer className="bg-gray-100 py-6 px-4 mt-12"><div className="max-w-4xl mx-auto text-center text-sm text-gray-500">Powered by <Link href="/home" className="text-blue-600">CaliforniaMailer</Link></div></footer>
    </div>
  );
}
