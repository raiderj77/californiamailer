'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { getCampaigns, getProspects, getInvoices, Campaign, Prospect, Invoice } from '@/lib/firestore';

export default function ReportsPage() {
  const { user, loading, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [c, p, i] = await Promise.all([
      getCampaigns(user.uid),
      getProspects(user.uid),
      getInvoices(user.uid),
    ]);
    setCampaigns(c);
    setProspects(p);
    setInvoices(i);
  }

  // Revenue calculations
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
  const pendingRevenue = invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.total, 0);
  const overdueRevenue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0);

  // Campaign costs
  const totalCost = campaigns.reduce((sum, c) => sum + c.cost, 0);
  const totalMailPieces = campaigns.reduce((sum, c) => sum + c.quantity, 0);

  // Profit
  const grossProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Conversion rates
  const closedProspects = prospects.filter(p => p.status === 'closed').length;
  const conversionRate = prospects.length > 0 ? (closedProspects / prospects.length) * 100 : 0;

  // Campaign performance
  const campaignsByType = {
    eddm: campaigns.filter(c => c.type === 'eddm'),
    coop: campaigns.filter(c => c.type === 'coop'),
    solo: campaigns.filter(c => c.type === 'solo'),
  };

  // Monthly breakdown (simplified)
  const invoicesByMonth: Record<string, number> = {};
  invoices.filter(i => i.status === 'paid').forEach(i => {
    const month = i.dueDate?.substring(0, 7) || 'Unknown';
    invoicesByMonth[month] = (invoicesByMonth[month] || 0) + i.total;
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Reports & Analytics</h2>

          {/* Revenue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">${totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Paid invoices</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Pending Revenue</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">${pendingRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Awaiting payment</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
              <p className="text-2xl font-bold text-red-600 mt-1">${overdueRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Past due date</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Gross Profit</h3>
              <p className={`text-2xl font-bold mt-1 ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${grossProfit.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">{profitMargin.toFixed(1)}% margin</p>
            </div>
          </div>

          {/* Campaign & Sales Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Campaigns</span>
                  <span className="font-bold">{campaigns.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Mail Pieces</span>
                  <span className="font-bold">{totalMailPieces.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Cost</span>
                  <span className="font-bold">${totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg Cost per Piece</span>
                  <span className="font-bold">
                    ${totalMailPieces > 0 ? (totalCost / totalMailPieces).toFixed(3) : '0'}
                  </span>
                </div>
                <hr />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xl font-bold text-blue-600">{campaignsByType.eddm.length}</div>
                    <div className="text-xs text-gray-500">EDDM</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-purple-600">{campaignsByType.coop.length}</div>
                    <div className="text-xs text-gray-500">Co-op</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-orange-600">{campaignsByType.solo.length}</div>
                    <div className="text-xs text-gray-500">Solo</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Prospects</span>
                  <span className="font-bold">{prospects.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Closed Deals</span>
                  <span className="font-bold text-green-600">{closedProspects}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="font-bold">{conversionRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Invoices</span>
                  <span className="font-bold">{invoices.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Paid Invoices</span>
                  <span className="font-bold text-green-600">
                    {invoices.filter(i => i.status === 'paid').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          {Object.keys(invoicesByMonth).length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-5 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Revenue (Paid)</h3>
              <div className="space-y-2">
                {Object.entries(invoicesByMonth)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([month, amount]) => (
                    <div key={month} className="flex items-center gap-4">
                      <span className="w-24 text-sm text-gray-600">{month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-green-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (amount / Math.max(...Object.values(invoicesByMonth))) * 100)}%`
                          }}
                        />
                      </div>
                      <span className="w-24 text-right font-medium">${amount.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top Performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Campaigns by Volume</h3>
              {campaigns.length === 0 ? (
                <p className="text-gray-500 text-sm">No campaigns yet</p>
              ) : (
                <ul className="space-y-3">
                  {campaigns
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 5)
                    .map(c => (
                      <li key={c.id} className="flex justify-between">
                        <span className="text-sm">{c.name}</span>
                        <span className="font-medium">{c.quantity.toLocaleString()} pcs</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Invoices</h3>
              {invoices.length === 0 ? (
                <p className="text-gray-500 text-sm">No invoices yet</p>
              ) : (
                <ul className="space-y-3">
                  {invoices
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)
                    .map(i => (
                      <li key={i.id} className="flex justify-between">
                        <span className="text-sm">{i.clientName}</span>
                        <span className="font-medium">${i.total.toLocaleString()}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
