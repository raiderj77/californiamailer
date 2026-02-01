'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Client, getClients, addClient, updateClient, deleteClient } from '@/lib/firestore';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
}

const emptyForm: FormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
};

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function ClientsPage() {
  const { user, loading, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  async function loadClients() {
    if (!user) return;
    const data = await getClients(user.uid);
    setClients(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (editing) {
      await updateClient(editing.id!, formData);
    } else {
      await addClient({
        ...formData,
        accessCode: generateAccessCode(),
        userId: user.uid,
      });
    }

    setShowForm(false);
    setEditing(null);
    setFormData(emptyForm);
    loadClients();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this client?')) {
      await deleteClient(id);
      loadClients();
    }
  }

  async function regenerateCode(client: Client) {
    const newCode = generateAccessCode();
    await updateClient(client.id!, { accessCode: newCode });
    loadClients();
  }

  function openEdit(client: Client) {
    setEditing(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      address: client.address,
    });
    setShowForm(true);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const filteredClients = clients.filter(c => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(query) ||
             c.company.toLowerCase().includes(query) ||
             c.email.toLowerCase().includes(query);
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
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
              <p className="text-sm text-gray-500">Manage client portal access</p>
            </div>
            <button
              onClick={() => { setShowForm(true); setEditing(null); setFormData(emptyForm); }}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
            >
              + Add Client
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-64"
            />
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Client' : 'New Client'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Company</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
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
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {filteredClients.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No clients yet. Add your first client.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClients.map((c) => (
                <div key={c.id} className="bg-white rounded-lg shadow-sm border p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium">{c.name}</h4>
                      {c.company && <p className="text-sm text-gray-500">{c.company}</p>}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    {c.email && <p>📧 {c.email}</p>}
                    {c.phone && <p>📞 {c.phone}</p>}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-500 mb-1">Access Code:</div>
                    <div className="flex items-center gap-2">
                      <code className="text-lg font-mono font-bold tracking-wider">{c.accessCode}</code>
                      <button
                        onClick={() => copyCode(c.accessCode)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {copiedCode === c.accessCode ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-3 border-t">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-sm">Edit</button>
                    <button onClick={() => regenerateCode(c)} className="text-orange-600 hover:underline text-sm">New Code</button>
                    <button onClick={() => handleDelete(c.id!)} className="text-red-600 hover:underline text-sm">Delete</button>
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
