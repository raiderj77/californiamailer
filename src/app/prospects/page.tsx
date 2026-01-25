'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { 
  Prospect, getProspects, addProspect, updateProspect, deleteProspect,
  Territory, getTerritories 
} from '@/lib/firestore';

export default function ProspectsPage() {
  const { user, loading, logout } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    territoryId: '',
    territoryName: '',
    status: 'new' as const,
    notes: '',
  });

  useEffect(() => {
    if (user) {
      loadProspects();
      loadTerritories();
    }
  }, [user]);

  async function loadProspects() {
    if (!user) return;
    const data = await getProspects(user.uid);
    setProspects(data);
  }

  async function loadTerritories() {
    if (!user) return;
    const data = await getTerritories(user.uid);
    setTerritories(data);
  }

  function handleTerritoryChange(territoryId: string) {
    const territory = territories.find(t => t.id === territoryId);
    setFormData({ 
      ...formData, 
      territoryId, 
      territoryName: territory?.name || '' 
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (editing) {
      await updateProspect(editing.id!, formData);
    } else {
      await addProspect({ ...formData, userId: user.uid });
    }

    setShowForm(false);
    setEditing(null);
    setFormData({ businessName: '', contactName: '', email: '', phone: '', address: '', city: '', territoryId: '', territoryName: '', status: 'new', notes: '' });
    loadProspects();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this prospect?')) {
      await deleteProspect(id);
      loadProspects();
    }
  }

  function openEdit(prospect: Prospect) {
    setEditing(prospect);
    setFormData({
      businessName: prospect.businessName,
      contactName: prospect.contactName,
      email: prospect.email,
      phone: prospect.phone,
      address: prospect.address,
      city: prospect.city,
      territoryId: prospect.territoryId,
      territoryName: prospect.territoryName,
      status: prospect.status,
      notes: prospect.notes,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(true);
    setEditing(null);
    setFormData({ businessName: '', contactName: '', email: '', phone: '', address: '', city: '', territoryId: '', territoryName: '', status: 'new', notes: '' });
  }

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    interested: 'bg-purple-100 text-purple-700',
    proposal: 'bg-orange-100 text-orange-700',
    closed: 'bg-green-100 text-green-700',
    lost: 'bg-gray-100 text-gray-700',
  };

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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Prospects</h2>
            <button onClick={resetForm} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              + Add Prospect
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Prospect' : 'New Prospect'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Business Name</label>
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Territory</label>
                    <select
                      value={formData.territoryId}
                      onChange={(e) => handleTerritoryChange(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select territory...</option>
                      {territories.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="interested">Interested</option>
                      <option value="proposal">Proposal</option>
                      <option value="closed">Closed</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {prospects.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No prospects yet. Add your first lead.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Business</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Contact</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Territory</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prospects.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <div>{p.businessName}</div>
                        <div className="text-sm text-gray-500">{p.email}</div>
                      </td>
                      <td className="px-4 py-3">{p.contactName}</td>
                      <td className="px-4 py-3">{p.territoryName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline mr-3">Edit</button>
                        <button onClick={() => handleDelete(p.id!)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
