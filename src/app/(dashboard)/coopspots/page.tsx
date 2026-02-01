'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { getCoopSpots, addCoopSpot, updateCoopSpot, deleteCoopSpot, CoopSpot } from '@/lib/firestore';

export default function CoopSpotsPage() {
  const { user } = useAuth();
  const [spots, setSpots] = useState<CoopSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({ campaignId: '', campaignName: '', territory: '', city: '', numberOfSpots: 12, price: 599, mailDate: '', households: 10000 });

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    try { const data = await getCoopSpots(); setSpots(data); } 
    catch (error) { console.error('Error:', error); } 
    finally { setLoading(false); }
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      for (let i = 1; i <= bulkFormData.numberOfSpots; i++) {
        await addCoopSpot({ campaignId: bulkFormData.campaignId, campaignName: bulkFormData.campaignName, territory: bulkFormData.territory, city: bulkFormData.city, spotNumber: i, totalSpots: bulkFormData.numberOfSpots, price: bulkFormData.price, mailDate: bulkFormData.mailDate, households: bulkFormData.households, status: 'available' });
      }
      setShowBulkForm(false);
      setBulkFormData({ campaignId: '', campaignName: '', territory: '', city: '', numberOfSpots: 12, price: 599, mailDate: '', households: 10000 });
      loadData();
      alert(`Created ${bulkFormData.numberOfSpots} spots!`);
    } catch (error) { console.error('Error:', error); alert('Error creating spots'); }
  }

  async function handleStatusChange(spot: CoopSpot, newStatus: 'available' | 'reserved' | 'sold') {
    if (!spot.id) return;
    try { await updateCoopSpot(spot.id, { status: newStatus }); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this spot?')) return;
    try { await deleteCoopSpot(id); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  const groupedSpots = spots.reduce((acc, spot) => {
    if (!acc[spot.campaignId]) { acc[spot.campaignId] = { campaignName: spot.campaignName, territory: spot.territory, city: spot.city, mailDate: spot.mailDate, households: spot.households, spots: [] }; }
    acc[spot.campaignId].spots.push(spot);
    return acc;
  }, {} as Record<string, { campaignName: string; territory: string; city: string; mailDate: string; households: number; spots: CoopSpot[] }>);

  const stats = { total: spots.length, available: spots.filter(s => s.status === 'available').length, reserved: spots.filter(s => s.status === 'reserved').length, sold: spots.filter(s => s.status === 'sold').length, revenue: spots.filter(s => s.status === 'sold').reduce((sum, s) => sum + s.price, 0) };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Please log in</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-2xl font-bold">Co-op Spots</h1><p className="text-gray-500">Manage co-op mailing spots</p></div>
          <button onClick={() => setShowBulkForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">+ Create Spots</button>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-sm text-gray-500">Total</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-green-600">{stats.available}</div><div className="text-sm text-gray-500">Available</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-yellow-600">{stats.reserved}</div><div className="text-sm text-gray-500">Reserved</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-blue-600">{stats.sold}</div><div className="text-sm text-gray-500">Sold</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-green-600">${stats.revenue.toLocaleString()}</div><div className="text-sm text-gray-500">Revenue</div></div>
        </div>

        {loading ? <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div> : Object.keys(groupedSpots).length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border"><div className="text-4xl mb-4">📋</div><h3 className="text-lg font-medium mb-2">No spots yet</h3><button onClick={() => setShowBulkForm(true)} className="text-blue-600 font-semibold">Create Spots →</button></div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSpots).map(([campaignId, campaign]) => (
              <div key={campaignId} className="bg-white rounded-lg border">
                <div className="bg-gray-50 border-b px-4 py-3 flex justify-between">
                  <div><h3 className="font-semibold">{campaign.campaignName}</h3><p className="text-sm text-gray-500">{campaign.territory} • {campaign.city}</p></div>
                  <div className="text-sm text-right"><div className="text-gray-500">Mail Date</div><div className="font-medium">{new Date(campaign.mailDate).toLocaleDateString()}</div></div>
                </div>
                <div className="p-4 grid grid-cols-6 gap-3">
                  {campaign.spots.sort((a, b) => a.spotNumber - b.spotNumber).map(spot => (
                    <div key={spot.id} className={`border rounded-lg p-3 ${spot.status === 'available' ? 'border-green-300 bg-green-50' : spot.status === 'reserved' ? 'border-yellow-300 bg-yellow-50' : 'border-blue-300 bg-blue-50'}`}>
                      <div className="flex justify-between mb-2"><span className="font-medium">#{spot.spotNumber}</span><span className={`text-xs px-2 py-1 rounded-full ${spot.status === 'available' ? 'bg-green-200 text-green-800' : spot.status === 'reserved' ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800'}`}>{spot.status}</span></div>
                      <div className="text-lg font-bold">${spot.price}</div>
                      <div className="mt-2 pt-2 border-t flex gap-1 text-xs">
                        {spot.status !== 'available' && <button onClick={() => handleStatusChange(spot, 'available')} className="text-green-600">Avl</button>}
                        {spot.status !== 'reserved' && <button onClick={() => handleStatusChange(spot, 'reserved')} className="text-yellow-600">Rsv</button>}
                        {spot.status !== 'sold' && <button onClick={() => handleStatusChange(spot, 'sold')} className="text-blue-600">Sold</button>}
                        <button onClick={() => spot.id && handleDelete(spot.id)} className="text-red-600 ml-auto">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {showBulkForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Create Co-op Spots</h2><button onClick={() => setShowBulkForm(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
              <form onSubmit={handleBulkCreate} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Campaign ID</label><input type="text" value={bulkFormData.campaignId} onChange={(e) => setBulkFormData({ ...bulkFormData, campaignId: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="SAL-FEB26" required /></div>
                <div><label className="block text-sm font-medium mb-1">Campaign Name</label><input type="text" value={bulkFormData.campaignName} onChange={(e) => setBulkFormData({ ...bulkFormData, campaignName: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Salinas February 2026" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Territory</label><input type="text" value={bulkFormData.territory} onChange={(e) => setBulkFormData({ ...bulkFormData, territory: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="93901" required /></div>
                  <div><label className="block text-sm font-medium mb-1">City</label><input type="text" value={bulkFormData.city} onChange={(e) => setBulkFormData({ ...bulkFormData, city: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Salinas" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1"># of Spots</label><input type="number" value={bulkFormData.numberOfSpots} onChange={(e) => setBulkFormData({ ...bulkFormData, numberOfSpots: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2" min="1" required /></div>
                  <div><label className="block text-sm font-medium mb-1">Price Each ($)</label><input type="number" value={bulkFormData.price} onChange={(e) => setBulkFormData({ ...bulkFormData, price: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2" min="0" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Mail Date</label><input type="date" value={bulkFormData.mailDate} onChange={(e) => setBulkFormData({ ...bulkFormData, mailDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" required /></div>
                  <div><label className="block text-sm font-medium mb-1">Households</label><input type="number" value={bulkFormData.households} onChange={(e) => setBulkFormData({ ...bulkFormData, households: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2" min="0" required /></div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowBulkForm(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Create {bulkFormData.numberOfSpots} Spots</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
