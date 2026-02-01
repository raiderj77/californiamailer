'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { getOffers, addOffer, updateOffer, deleteOffer, Offer } from '@/lib/firestore';

export default function OffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState({ code: '', businessName: '', headline: '', description: '', discount: '', terms: '', expirationDate: '', phone: '', website: '', address: '', campaignId: '', category: '', cta: 'Call Now', accentColor: 'blue' });

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    try { const data = await getOffers(); setOffers(data); } 
    catch (error) { console.error('Error:', error); } 
    finally { setLoading(false); }
  }

  function resetForm() {
    setFormData({ code: '', businessName: '', headline: '', description: '', discount: '', terms: '', expirationDate: '', phone: '', website: '', address: '', campaignId: '', category: '', cta: 'Call Now', accentColor: 'blue' });
    setEditingOffer(null);
  }

  function handleEdit(offer: Offer) {
    setFormData({ code: offer.code, businessName: offer.businessName, headline: offer.headline, description: offer.description, discount: offer.discount, terms: offer.terms, expirationDate: offer.expirationDate, phone: offer.phone || '', website: offer.website || '', address: offer.address || '', campaignId: offer.campaignId, category: offer.category, cta: offer.cta, accentColor: offer.accentColor });
    setEditingOffer(offer);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const offerData = { ...formData, backgroundColor: `from-${formData.accentColor}-600 to-${formData.accentColor}-800`, redemptions: 0, views: 0, isActive: true };
      if (editingOffer?.id) { await updateOffer(editingOffer.id, offerData); } 
      else { await addOffer(offerData); }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) { console.error('Error:', error); alert('Error saving offer'); }
  }

  async function handleToggleActive(offer: Offer) {
    if (!offer.id) return;
    try { await updateOffer(offer.id, { isActive: !offer.isActive }); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this offer?')) return;
    try { await deleteOffer(id); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  const colorOptions = ['blue', 'green', 'red', 'purple', 'orange', 'teal'];

  if (!user) return <div className="min-h-screen flex items-center justify-center">Please log in</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-2xl font-bold">Offers & Coupons</h1><p className="text-gray-500">Manage trackable coupon pages</p></div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">+ Create Offer</button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold">{offers.length}</div><div className="text-sm text-gray-500">Total Offers</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-green-600">{offers.filter(o => o.isActive).length}</div><div className="text-sm text-gray-500">Active</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-purple-600">{offers.reduce((sum, o) => sum + (o.views || 0), 0)}</div><div className="text-sm text-gray-500">Total Views</div></div>
          <div className="bg-white rounded-lg border p-4"><div className="text-2xl font-bold text-orange-600">{offers.reduce((sum, o) => sum + (o.redemptions || 0), 0)}</div><div className="text-sm text-gray-500">Redemptions</div></div>
        </div>

        {loading ? <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div> : offers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border"><div className="text-4xl mb-4">🎟️</div><h3 className="text-lg font-medium mb-2">No offers yet</h3><button onClick={() => setShowForm(true)} className="text-blue-600 font-semibold">Create Offer →</button></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map(offer => (
              <div key={offer.id} className={`bg-white rounded-lg border overflow-hidden ${!offer.isActive ? 'opacity-60' : ''}`}>
                <div className={`bg-gradient-to-r from-${offer.accentColor}-600 to-${offer.accentColor}-800 text-white p-4`}>
                  <div className="text-2xl font-bold">{offer.discount}</div>
                  <div className="text-sm opacity-80">{offer.businessName}</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1">{offer.headline}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{offer.code}</span>
                    <span>•</span>
                    <span>{new Date(offer.expirationDate) < new Date() ? 'Expired' : `Exp: ${new Date(offer.expirationDate).toLocaleDateString()}`}</span>
                  </div>
                  <div className="flex gap-4 text-sm mb-4">
                    <div><span className="text-gray-500">Views:</span> <span className="font-semibold">{offer.views || 0}</span></div>
                    <div><span className="text-gray-500">Redemptions:</span> <span className="font-semibold">{offer.redemptions || 0}</span></div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t text-sm">
                    <a href={`/offer/${offer.code}`} target="_blank" className="text-blue-600 hover:underline">View →</a>
                    <button onClick={() => handleEdit(offer)} className="text-gray-600 hover:underline">Edit</button>
                    <button onClick={() => handleToggleActive(offer)} className={offer.isActive ? 'text-orange-600' : 'text-green-600'}>{offer.isActive ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => offer.id && handleDelete(offer.id)} className="text-red-600 ml-auto">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4">
              <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">{editingOffer ? 'Edit Offer' : 'Create Offer'}</h2><button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">✕</button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Offer Code</label><input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 font-mono" placeholder="SAVE20" required /></div>
                  <div><label className="block text-sm font-medium mb-1">Business Name</label><input type="text" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className="w-full border rounded-lg px-3 py-2" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Discount (e.g. $20 OFF)</label><input type="text" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} className="w-full border rounded-lg px-3 py-2" required /></div>
                  <div><label className="block text-sm font-medium mb-1">Category</label><input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Plumbing, Dental..." required /></div>
                </div>
                <div><label className="block text-sm font-medium mb-1">Headline</label><input type="text" value={formData.headline} onChange={(e) => setFormData({ ...formData, headline: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="$20 OFF Any Service Call" required /></div>
                <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 h-20" required /></div>
                <div><label className="block text-sm font-medium mb-1">Terms</label><textarea value={formData.terms} onChange={(e) => setFormData({ ...formData, terms: e.target.value })} className="w-full border rounded-lg px-3 py-2 h-16" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Expiration Date</label><input type="date" value={formData.expirationDate} onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" required /></div>
                  <div><label className="block text-sm font-medium mb-1">CTA Button Text</label><input type="text" value={formData.cta} onChange={(e) => setFormData({ ...formData, cta: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                  <div><label className="block text-sm font-medium mb-1">Website</label><input type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                </div>
                <div><label className="block text-sm font-medium mb-1">Address</label><input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Campaign ID</label><input type="text" value={formData.campaignId} onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                  <div><label className="block text-sm font-medium mb-1">Color</label><select value={formData.accentColor} onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })} className="w-full border rounded-lg px-3 py-2">{colorOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">{editingOffer ? 'Update' : 'Create'} Offer</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
