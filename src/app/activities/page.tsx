'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Activity, getActivities, addActivity, deleteActivity, Prospect, getProspects } from '@/lib/firestore';
import { downloadCSV } from '@/lib/csv';

type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'proposal';

interface FormData {
  prospectId: string;
  prospectName: string;
  type: ActivityType;
  description: string;
  outcome: string;
  followUpDate: string;
}

const emptyForm: FormData = {
  prospectId: '',
  prospectName: '',
  type: 'call',
  description: '',
  outcome: '',
  followUpDate: '',
};

export default function ActivitiesPage() {
  const { user, loading, logout } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  
  const [filterType, setFilterType] = useState('all');
  const [filterProspect, setFilterProspect] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [a, p] = await Promise.all([
      getActivities(user.uid),
      getProspects(user.uid),
    ]);
    setActivities(a);
    setProspects(p);
  }

  function handleProspectChange(prospectId: string) {
    const prospect = prospects.find(p => p.id === prospectId);
    setFormData({
      ...formData,
      prospectId,
      prospectName: prospect?.businessName || '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    await addActivity({ ...formData, userId: user.uid });

    setShowForm(false);
    setFormData(emptyForm);
    loadData();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this activity?')) {
      await deleteActivity(id);
      loadData();
    }
  }

  const typeColors: Record<string, string> = {
    call: 'bg-blue-100 text-blue-700',
    email: 'bg-green-100 text-green-700',
    meeting: 'bg-purple-100 text-purple-700',
    note: 'bg-gray-100 text-gray-700',
    proposal: 'bg-orange-100 text-orange-700',
  };

  const typeIcons: Record<string, string> = {
    call: '📞',
    email: '✉️',
    meeting: '🤝',
    note: '📝',
    proposal: '📋',
  };

  const filteredActivities = activities.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterProspect !== 'all' && a.prospectId !== filterProspect) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return a.prospectName.toLowerCase().includes(query) ||
             a.description.toLowerCase().includes(query) ||
             a.outcome.toLowerCase().includes(query);
    }
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
            <h2 className="text-2xl font-bold text-gray-900">Activity Log</h2>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              + Log Activity
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-64"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="note">Note</option>
                <option value="proposal">Proposal</option>
              </select>
              <select
                value={filterProspect}
                onChange={(e) => setFilterProspect(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Prospects</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>{p.businessName}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">
                Showing {filteredActivities.length} of {activities.length}
              </span>
              <button
                onClick={() => downloadCSV(filteredActivities.map(a => ({
                  'Prospect': a.prospectName,
                  'Type': a.type,
                  'Description': a.description,
                  'Outcome': a.outcome,
                  'Follow Up': a.followUpDate,
                })), 'activities')}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
              >
                Export CSV
              </button>
            </div>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">Log Activity</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prospect</label>
                    <select
                      value={formData.prospectId}
                      onChange={(e) => handleProspectChange(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select prospect...</option>
                      {prospects.map((p) => (
                        <option key={p.id} value={p.id}>{p.businessName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as ActivityType })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="call">📞 Call</option>
                      <option value="email">✉️ Email</option>
                      <option value="meeting">🤝 Meeting</option>
                      <option value="note">📝 Note</option>
                      <option value="proposal">📋 Proposal</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Outcome</label>
                    <input
                      type="text"
                      value={formData.outcome}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., Left voicemail, Scheduled demo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Save Activity
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {filteredActivities.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No activities logged yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((a) => (
                <div key={a.id} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="text-2xl">{typeIcons[a.type]}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{a.prospectName}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${typeColors[a.type]}`}>
                            {a.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                        {a.outcome && (
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Outcome:</span> {a.outcome}
                          </p>
                        )}
                        {a.followUpDate && (
                          <p className="text-sm text-orange-600 mt-1">
                            📅 Follow-up: {a.followUpDate}
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(a.id!)} className="text-red-600 hover:underline text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
