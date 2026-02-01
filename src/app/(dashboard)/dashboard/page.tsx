'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { getTerritories, getProspects, getCampaigns, getVATasks, Territory, Prospect, Campaign, VATask } from '@/lib/firestore';

export default function DashboardPage() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<VATask[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [t, p, c, v] = await Promise.all([
      getTerritories(user.uid),
      getProspects(user.uid),
      getCampaigns(user.uid),
      getVATasks(user.uid),
    ]);
    setTerritories(t);
    setProspects(p);
    setCampaigns(c);
    setTasks(v);
  }

  // Calculate stats
  const activeTerritories = territories.filter(t => t.status === 'active').length;
  const totalHouseholds = territories.reduce((sum, t) => sum + t.households, 0);
  
  const prospectsByStatus = {
    new: prospects.filter(p => p.status === 'new').length,
    contacted: prospects.filter(p => p.status === 'contacted').length,
    interested: prospects.filter(p => p.status === 'interested').length,
    proposal: prospects.filter(p => p.status === 'proposal').length,
    closed: prospects.filter(p => p.status === 'closed').length,
    lost: prospects.filter(p => p.status === 'lost').length,
  };

  const activeCampaigns = campaigns.filter(c => c.status !== 'completed').length;
  const totalMailPieces = campaigns.reduce((sum, c) => sum + c.quantity, 0);
  const totalCampaignCost = campaigns.reduce((sum, c) => sum + c.cost, 0);

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

  // Recent items
  const recentProspects = prospects.slice(0, 5);
  const upcomingCampaigns = campaigns
    .filter(c => c.status === 'scheduled' && c.mailDate)
    .sort((a, b) => a.mailDate.localeCompare(b.mailDate))
    .slice(0, 5);
  const urgentTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">CaliforniaMailer</h1>
          <p className="text-gray-600 mb-8">Direct mail management for California territories</p>
          <button
            onClick={signInWithGoogle}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
          
          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Active Territories</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{activeTerritories}</p>
              <p className="text-xs text-gray-400 mt-1">{totalHouseholds.toLocaleString()} households</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Total Prospects</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{prospects.length}</p>
              <p className="text-xs text-gray-400 mt-1">{prospectsByStatus.closed} closed</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Active Campaigns</h3>
              <p className="text-2xl font-bold text-purple-600 mt-1">{activeCampaigns}</p>
              <p className="text-xs text-gray-400 mt-1">{totalMailPieces.toLocaleString()} pieces</p>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border">
              <h3 className="text-sm font-medium text-gray-500">Pending Tasks</h3>
              <p className="text-2xl font-bold text-orange-600 mt-1">{pendingTasks + inProgressTasks}</p>
              <p className="text-xs text-gray-400 mt-1">{highPriorityTasks} high priority</p>
            </div>
          </div>

          {/* Prospect Pipeline */}
          <div className="bg-white rounded-lg shadow-sm border p-5 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Prospect Pipeline</h3>
            <div className="flex gap-2">
              {Object.entries(prospectsByStatus).map(([status, count]) => (
                <div key={status} className="flex-1 text-center">
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500 capitalize">{status}</div>
                  <div 
                    className={`h-2 mt-2 rounded ${
                      status === 'new' ? 'bg-blue-400' :
                      status === 'contacted' ? 'bg-yellow-400' :
                      status === 'interested' ? 'bg-purple-400' :
                      status === 'proposal' ? 'bg-orange-400' :
                      status === 'closed' ? 'bg-green-400' :
                      'bg-gray-300'
                    }`}
                    style={{ width: `${Math.max(10, (count / Math.max(prospects.length, 1)) * 100)}%`, margin: '0 auto' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Recent Prospects */}
            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Prospects</h3>
              {recentProspects.length === 0 ? (
                <p className="text-gray-500 text-sm">No prospects yet</p>
              ) : (
                <ul className="space-y-3">
                  {recentProspects.map(p => (
                    <li key={p.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{p.businessName}</div>
                        <div className="text-xs text-gray-500">{p.territoryName}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.status === 'new' ? 'bg-blue-100 text-blue-700' :
                        p.status === 'closed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Upcoming Campaigns */}
            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Campaigns</h3>
              {upcomingCampaigns.length === 0 ? (
                <p className="text-gray-500 text-sm">No scheduled campaigns</p>
              ) : (
                <ul className="space-y-3">
                  {upcomingCampaigns.map(c => (
                    <li key={c.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.quantity.toLocaleString()} pieces</div>
                      </div>
                      <span className="text-xs text-gray-600">{c.mailDate}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Urgent Tasks */}
            <div className="bg-white rounded-lg shadow-sm border p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Priority Tasks</h3>
              {urgentTasks.length === 0 ? (
                <p className="text-gray-500 text-sm">No pending tasks</p>
              ) : (
                <ul className="space-y-3">
                  {urgentTasks.map(t => (
                    <li key={t.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{t.title}</div>
                        <div className="text-xs text-gray-500">{t.assignee || 'Unassigned'}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        t.priority === 'high' ? 'bg-red-100 text-red-700' :
                        t.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {t.priority}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Campaign Stats */}
          {campaigns.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-5 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Summary</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{campaigns.length}</div>
                  <div className="text-xs text-gray-500">Total Campaigns</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalMailPieces.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Mail Pieces</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">${totalCampaignCost.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total Cost</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${totalMailPieces > 0 ? (totalCampaignCost / totalMailPieces).toFixed(3) : '0'}
                  </div>
                  <div className="text-xs text-gray-500">Avg Cost/Piece</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
