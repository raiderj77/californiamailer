'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Territory, getTerritories, addTerritory, updateTerritory, deleteTerritory } from '@/lib/firestore';

export default function TerritoriesPage() {
  const { user, loading, logout } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Territory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    county: '',
    cities: '',
    households: 0,
    avgIncome: 0,
    status: 'research' as const,
    notes: '',
  });

  useEffect(() => {
    if (user) {
      loadTerritories();
    }
  }, [user]);

  async function loadTerritories() {
    if (!user) return;
    const data = await getTerritories(user.uid);
    setTerritories(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (editing) {
      await updateTerritory(editing.id!, formData);
    } else {
      await addTerritory({ ...formData, userId: user.uid });
    }

    setShowForm(false);
    setEditing(null);
    setFormData({ name: '', county: '', cities: '', households: 0, avgIncome: 0, status: 'research', notes: '' });
    loadTerritories();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this territory?')) {
      await deleteTerritory(id);
      loadTerritories();
    }
  }

  function openEdit(territory: Territory) {
    setEditing(territory);
    setFormData({
      name: territory.name,
      county: territory.county,
      cities: territory.cities,
      households: territory.households,
      avgIncome: territory.avgIncome,
      status: territory.status,
      notes: territory.notes,
    });
    setShowForm(true);
  }

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
            <h2 className="text-2xl font-bold text-gray-900">Territories</h2>
            <button
              onClick={() => { setShowForm(true); setEditing(null); setFormData({ name: '', county: '', cities: '', households: 0, avgIncome: 0, status: 'research', notes: '' }); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Add Territory
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Territory' : 'New Territory'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                    <input
                      type="text"
                      value={formData.county}
                      onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cities</label>
                    <input
                      type="text"
                      value={formData.cities}
                      onChange={(e) => setFormData({ ...formData, cities: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Salinas, Monterey, Carmel"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Households</label>
                    <input
                      type="number"
                      value={formData.households}
                      onChange={(e) => setFormData({ ...formData, households: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Avg Income</label>
                    <input
                      type="number"
                      value={formData.avgIncome}
                      onChange={(e) => setFormData({ ...formData, avgIncome: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="research">Research</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {territories.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No territories yet. Add your first market area.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">County</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Households</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {territories.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">{t.name}</td>
                      <td className="px-4 py-3">{t.county}</td>
                      <td className="px-4 py-3">{t.households.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          t.status === 'active' ? 'bg-green-100 text-green-700' :
                          t.status === 'research' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline mr-3">Edit</button>
                        <button onClick={() => handleDelete(t.id!)} className="text-red-600 hover:underline">Delete</button>
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
