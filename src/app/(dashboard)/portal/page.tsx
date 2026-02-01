'use client';

import { useState } from 'react';
import { getClientByAccessCode, Client, getCampaigns, getInvoices, Campaign, Invoice } from '@/lib/firestore';

export default function PortalPage() {
  const [accessCode, setAccessCode] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setClient(null);

    try {
      const foundClient = await getClientByAccessCode(accessCode.toUpperCase());
      
      if (!foundClient) {
        setError('Invalid access code. Please try again.');
        setLoading(false);
        return;
      }

      setClient(foundClient);

      // Load campaigns and invoices for this client's owner
      const [c, i] = await Promise.all([
        getCampaigns(foundClient.userId),
        getInvoices(foundClient.userId),
      ]);

      // Filter to only show campaigns/invoices related to this client
      const clientCampaigns = c.filter(campaign => 
        campaign.notes?.toLowerCase().includes(foundClient.company.toLowerCase()) ||
        campaign.notes?.toLowerCase().includes(foundClient.name.toLowerCase())
      );
      
      const clientInvoices = i.filter(invoice => 
        invoice.clientName.toLowerCase() === foundClient.name.toLowerCase() ||
        invoice.clientName.toLowerCase() === foundClient.company.toLowerCase()
      );

      setCampaigns(clientCampaigns);
      setInvoices(clientInvoices);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  }

  function handleLogout() {
    setClient(null);
    setCampaigns([]);
    setInvoices([]);
    setAccessCode('');
  }

  const statusColors: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-blue-100 text-blue-700',
    mailed: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
  };

  // Not logged in - show access form
  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">CaliforniaMailer</h1>
            <p className="text-gray-500 mt-1">Client Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Access Code</label>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="w-full border rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-widest"
                placeholder="XXXXXXXX"
                maxLength={8}
                required
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || accessCode.length < 8}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Checking...' : 'View My Campaigns'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Enter the access code provided by your mail service provider
          </p>
        </div>
      </div>
    );
  }

  // Logged in - show client dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">CaliforniaMailer</h1>
            <p className="text-sm text-gray-500">Client Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{client.company || client.name}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-medium mb-2">Welcome, {client.name}!</h2>
          <p className="text-gray-500">Here's the status of your direct mail campaigns.</p>
        </div>

        {/* Campaigns */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">Your Campaigns</h3>
          {campaigns.length === 0 ? (
            <p className="text-gray-500">No campaigns found. Check back soon!</p>
          ) : (
            <div className="space-y-4">
              {campaigns.map(c => (
                <div key={c.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{c.name}</h4>
                      <p className="text-sm text-gray-500">{c.territoryName}</p>
                    </div>
                    <span className={`px-3 py-1 rounded text-sm ${statusColors[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2 font-medium">{c.type.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium">{c.quantity.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Mail Date:</span>
                      <span className="ml-2 font-medium">{c.mailDate || 'TBD'}</span>
                    </div>
                  </div>
                  {c.status === 'mailed' && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                      ✓ Your mailers have been sent and should arrive within 5-7 business days.
                    </div>
                  )}
                  {c.status === 'scheduled' && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                      📅 Your campaign is scheduled to mail on {c.mailDate}.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium mb-4">Your Invoices</h3>
          {invoices.length === 0 ? (
            <p className="text-gray-500">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Invoice #</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Campaign</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Amount</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Due Date</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map(i => (
                    <tr key={i.id}>
                      <td className="px-4 py-3 font-medium">{i.invoiceNumber}</td>
                      <td className="px-4 py-3">{i.campaignName || '-'}</td>
                      <td className="px-4 py-3">${i.total.toFixed(2)}</td>
                      <td className="px-4 py-3">{i.dueDate || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[i.status]}`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          Questions? Contact your mail service provider.
        </div>
      </main>
    </div>
  );
}
