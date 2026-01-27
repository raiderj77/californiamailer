'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { getProofs, addProof, approveProof, requestProofRevision, deleteProof, getCampaigns, getClients, Proof, Campaign, Client } from '@/lib/firestore';

export default function ProofsPage() {
  const { user } = useAuth();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'revision-requested'>('all');
  const [formData, setFormData] = useState({ campaignId: '', clientId: '', fileUrl: '', thumbnailUrl: '' });

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    try {
      const [proofsData, campaignsData, clientsData] = await Promise.all([getProofs(), getCampaigns(user!.uid), getClients(user!.uid)]);
      setProofs(proofsData);
      setCampaigns(campaignsData);
      setClients(clientsData);
    } catch (error) { console.error('Error:', error); } 
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const campaign = campaigns.find(c => c.id === formData.campaignId);
    const client = clients.find(c => c.id === formData.clientId);
    if (!campaign || !client) { alert('Select campaign and client'); return; }
    const existingProofs = proofs.filter(p => p.campaignId === formData.campaignId);
    try {
      await addProof({ campaignId: formData.campaignId, campaignName: campaign.name, clientId: formData.clientId, clientName: client.name || client.company || 'Client', clientEmail: client.email, version: existingProofs.length + 1, fileUrl: formData.fileUrl, thumbnailUrl: formData.thumbnailUrl, status: 'pending', sentAt: new Date() });
      setShowForm(false);
      setFormData({ campaignId: '', clientId: '', fileUrl: '', thumbnailUrl: '' });
      loadData();
    } catch (error) { console.error('Error:', error); alert('Error adding proof'); }
  }

  async function handleApprove(proof: Proof) {
    if (!proof.id || !confirm('Approve this proof?')) return;
    try { await approveProof(proof.id, 'Admin'); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  async function handleRevision(proof: Proof) {
    if (!proof.id) return;
    const feedback = prompt('Enter revision feedback:');
    if (!feedback) return;
    try { await requestProofRevision(proof.id, feedback); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this proof?')) return;
    try { await deleteProof(id); loadData(); } 
    catch (error) { console.error('Error:', error); }
  }

  const filteredProofs = proofs.filter(p => filter === 'all' || p.status === filter);
  const counts = { all: proofs.length, pending: proofs.filter(p => p.status === 'pending').length, approved: proofs.filter(p => p.status === 'approved').length, 'revision-requested': proofs.filter(p => p.status === 'revision-requested').length };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Please log in</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-2xl font-bold">Proof Approvals</h1><p className="text-gray-500">Manage design proofs</p></div>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">+ Upload Proof</button>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {(['all', 'pending', 'approved', 'revision-requested'] as const).map(status => (
            <button key={status} onClick={() => setFilter(status)} className={`px-4 py-2 font-medium capitalize border-b-2 -mb-px ${filter === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              {status === 'revision-requested' ? 'Revisions' : status} ({counts[status]})
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div> : filteredProofs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border"><div className="text-4xl mb-4">📋</div><h3 className="text-lg font-medium mb-2">No proofs</h3></div>
        ) : (
          <div className="space-y-4">
            {filteredProofs.map(proof => (
              <div key={proof.id} className="bg-white border rounded-lg p-4 flex gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {proof.thumbnailUrl ? <img src={proof.thumbnailUrl} alt="Proof" className="w-full h-full object-cover" /> : <span className="text-gray-400">📄</span>}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-semibold">{proof.campaignName}</h3><p className="text-sm text-gray-500">v{proof.version} • {proof.clientName}</p></div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${proof.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : proof.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{proof.status}</span>
                  </div>
                  {proof.feedback && <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700"><strong>Feedback:</strong> {proof.feedback}</div>}
                  <div className="mt-3 flex gap-2 text-sm">
                    <a href={proof.fileUrl} target="_blank" className="text-blue-600 hover:underline">View Proof →</a>
                    {proof.status === 'pending' && <>
                      <button onClick={() => handleApprove(proof)} className="text-green-600 hover:underline">Approve</button>
                      <button onClick={() => handleRevision(proof)} className="text-orange-600 hover:underline">Request Revision</button>
                    </>}
                    <button onClick={() => proof.id && handleDelete(proof.id)} className="text-red-600 hover:underline ml-auto">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Upload Proof</h2><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Campaign</label><select value={formData.campaignId} onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })} className="w-full border rounded-lg px-3 py-2" required><option value="">Select...</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Client</label><select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full border rounded-lg px-3 py-2" required><option value="">Select...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name || c.company}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Proof File URL</label><input type="url" value={formData.fileUrl} onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="https://drive.google.com/..." required /></div>
                <div><label className="block text-sm font-medium mb-1">Thumbnail URL (optional)</label><input type="url" value={formData.thumbnailUrl} onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Upload</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
