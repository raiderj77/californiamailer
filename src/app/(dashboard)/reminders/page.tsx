'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Reminder, getReminders, addReminder, updateReminder, deleteReminder, Prospect, getProspects, Campaign, getCampaigns } from '@/lib/firestore';

type RelatedTo = 'prospect' | 'campaign' | 'task' | 'other';

interface FormData {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  relatedTo: RelatedTo;
  relatedId: string;
  relatedName: string;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  dueDate: '',
  dueTime: '09:00',
  relatedTo: 'other',
  relatedId: '',
  relatedName: '',
};

export default function RemindersPage() {
  const { user, loading, logout } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [r, p, c] = await Promise.all([
      getReminders(user.uid),
      getProspects(user.uid),
      getCampaigns(user.uid),
    ]);
    setReminders(r);
    setProspects(p);
    setCampaigns(c);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    await addReminder({ ...formData, completed: false, userId: user.uid });

    setShowForm(false);
    setFormData(emptyForm);
    loadData();
  }

  async function toggleComplete(reminder: Reminder) {
    await updateReminder(reminder.id!, { completed: !reminder.completed });
    loadData();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this reminder?')) {
      await deleteReminder(id);
      loadData();
    }
  }

  function handleRelatedChange(relatedTo: RelatedTo) {
    setFormData({ ...formData, relatedTo, relatedId: '', relatedName: '' });
  }

  function handleRelatedItemChange(id: string) {
    let name = '';
    if (formData.relatedTo === 'prospect') {
      name = prospects.find(p => p.id === id)?.businessName || '';
    } else if (formData.relatedTo === 'campaign') {
      name = campaigns.find(c => c.id === id)?.name || '';
    }
    setFormData({ ...formData, relatedId: id, relatedName: name });
  }

  const today = new Date().toISOString().split('T')[0];
  
  const pendingReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);
  
  const overdueReminders = pendingReminders.filter(r => r.dueDate < today);
  const todayReminders = pendingReminders.filter(r => r.dueDate === today);
  const upcomingReminders = pendingReminders.filter(r => r.dueDate > today);

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
            <h2 className="text-2xl font-bold text-gray-900">Reminders</h2>
            <button onClick={() => setShowForm(true)} className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
              + Add Reminder
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">New Reminder</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time</label>
                    <input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Related To</label>
                    <select
                      value={formData.relatedTo}
                      onChange={(e) => handleRelatedChange(e.target.value as RelatedTo)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="other">General</option>
                      <option value="prospect">Prospect</option>
                      <option value="campaign">Campaign</option>
                    </select>
                  </div>
                  {formData.relatedTo !== 'other' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Select {formData.relatedTo}</label>
                      <select
                        value={formData.relatedId}
                        onChange={(e) => handleRelatedItemChange(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Select...</option>
                        {formData.relatedTo === 'prospect' && prospects.map((p) => (
                          <option key={p.id} value={p.id}>{p.businessName}</option>
                        ))}
                        {formData.relatedTo === 'campaign' && campaigns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
                    Save
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {overdueReminders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-red-600 mb-3">⚠️ Overdue ({overdueReminders.length})</h3>
              <div className="space-y-2">
                {overdueReminders.map((r) => (
                  <div key={r.id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={r.completed}
                        onChange={() => toggleComplete(r)}
                        className="w-5 h-5"
                      />
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-sm text-gray-500">
                          {r.dueDate} at {r.dueTime}
                          {r.relatedName && <span> • {r.relatedName}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(r.id!)} className="text-red-600 hover:underline text-sm">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayReminders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-orange-600 mb-3">📅 Today ({todayReminders.length})</h3>
              <div className="space-y-2">
                {todayReminders.map((r) => (
                  <div key={r.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={r.completed}
                        onChange={() => toggleComplete(r)}
                        className="w-5 h-5"
                      />
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-sm text-gray-500">
                          {r.dueTime}
                          {r.relatedName && <span> • {r.relatedName}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(r.id!)} className="text-red-600 hover:underline text-sm">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingReminders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-blue-600 mb-3">🔜 Upcoming ({upcomingReminders.length})</h3>
              <div className="space-y-2">
                {upcomingReminders.map((r) => (
                  <div key={r.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={r.completed}
                        onChange={() => toggleComplete(r)}
                        className="w-5 h-5"
                      />
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-sm text-gray-500">
                          {r.dueDate} at {r.dueTime}
                          {r.relatedName && <span> • {r.relatedName}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(r.id!)} className="text-red-600 hover:underline text-sm">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingReminders.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No reminders. Add one to stay on track.</p>
            </div>
          )}

          {completedReminders.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-gray-500 hover:text-gray-700 text-sm mb-3"
              >
                {showCompleted ? '▼' : '▶'} Completed ({completedReminders.length})
              </button>
              {showCompleted && (
                <div className="space-y-2">
                  {completedReminders.map((r) => (
                    <div key={r.id} className="bg-gray-50 border rounded-lg p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={r.completed}
                          onChange={() => toggleComplete(r)}
                          className="w-5 h-5"
                        />
                        <div className="line-through text-gray-400">
                          <div>{r.title}</div>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(r.id!)} className="text-red-600 hover:underline text-sm">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
