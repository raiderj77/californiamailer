'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { 
  Campaign, getCampaigns, addCampaign, updateCampaign, deleteCampaign,
  Territory, getTerritories 
} from '@/lib/firestore'; import { downloadCSV } from '@/lib/csv';

type CampaignType = 'eddm' | 'coop' | 'solo';
type CampaignStatus = 'planning' | 'scheduled' | 'mailed' | 'completed';

interface FormData {
  name: string;
  type: CampaignType;
  territoryId: string;
  territoryName: string;
  mailDate: string;
  quantity: number;
  cost: number;
  status: CampaignStatus;
  notes: string;
}

const emptyForm: FormData = {
  name: '',
  type: 'eddm',
  territoryId: '',
  territoryName: '',
  mailDate: '',
  quantity: 0,
  cost: 0,
  status: 'planning',
  notes: '',
};

export default function CampaignsPage() {
  const { user, loading, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterTerritory, setFilterTerritory] = useState('all');

  useEffect(() => {
    if (user) {
      loadCampaigns();
      loadTerritories();
    }
  }, [user]);

  async function loadCampaigns() {
    if (!user) return;
    const data = await getCampaigns(user.uid);
    setCampaigns(data);
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
      await updateCampaign(editing.id!, formData);
    } else {
      await addCampaign({ ...formData, userId: user.uid });
    }

    setShowForm(false);
    setEditing(null);
    setFormData(emptyForm);
    loadCampaigns();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this campaign?')) {
      await deleteCampaign(id);
      loadCampaigns();
    }
  }

  function openEdit(campaign: Campaign) {
    setEditing(campaign);
    setFormData({
      name: campaign.name,
      type: campaign.type,
      territoryId: campaign.territoryId,
      territoryName: campaign.territoryName,
      mailDate: campaign.mailDate,
      quantity: campaign.quantity,
      cost: campaign.cost,
      status: campaign.status,
      notes: campaign.notes,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(true);
    setEditing(null);
    setFormData(emptyForm);
  }

  const statusColors: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-blue-100 text-blue-700',
    mailed: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
  };

  const typeLabels: Record<string, string> = {
    eddm: 'EDDM',
    coop: '9x12 Co-op',
    solo: 'Solo Mail',
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterTerritory !== 'all' && c.territoryId !== filterTerritory) return false;
    return true;
  });

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
            <h2 className="text-2xl font-bold text-gray-900">Campaigns</h2>
            <button onClick={resetForm} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              + New Campaign
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="planning">Planning</option>
                <option value="scheduled">Scheduled</option>
                <option value="mailed">Mailed</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="eddm">EDDM</option>
                <option value="coop">9x12 Co-op</option>
                <option value="solo">Solo Mail</option>
              </select>
              <select
                value={filterTerritory}
                onChange={(e) => setFilterTerritory(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Territories</option>
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">
                Showing {filteredCampaigns.length} of {campaigns.length}
              </span>
              <button
                onClick={() => downloadCSV(filteredCampaigns.map(c => ({
                  'Name': c.name,
                  'Type': c.type,
                  'Territory': c.territoryName,
                  'Mail Date': c.mailDate,
                  'Quantity': c.quantity,
                  'Cost': c.cost,
                  'Status': c.status,
                  'Notes': c.notes,
                })), 'campaigns')}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
              >
                Export CSV
              </button>
            </div>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Campaign' : 'New Campaign'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Campaign Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as CampaignType })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="eddm">EDDM</option>
                      <option value="coop">9x12 Co-op</option>
                      <option value="solo">Solo Mail</option>
                    </select>
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
                    <label className="block text-sm font-medium mb-1">Mail Date</label>
                    <input
                      type="date"
                      value={formData.mailDate}
                      onChange={(e) => setFormData({ ...formData, mailDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cost ($)</label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as CampaignStatus })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="planning">Planning</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="mailed">Mailed</option>
                      <option value="completed">Completed</option>
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
                  <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {filteredCampaigns.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">
                {campaigns.length === 0 ? 'No campaigns yet. Create your first campaign.' : 'No campaigns match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Territory</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Mail Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Quantity</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCampaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3">{typeLabels[c.type]}</td>
                      <td className="px-4 py-3">{c.territoryName}</td>
                      <td className="px-4 py-3">{c.mailDate || '-'}</td>
                      <td className="px-4 py-3">{c.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[c.status]}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline mr-3">Edit</button>
                        <button onClick={() => handleDelete(c.id!)} className="text-red-600 hover:underline">Delete</button>
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
