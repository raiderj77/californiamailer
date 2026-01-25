'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { getTerritories, getProspects, getCampaigns } from '@/lib/firestore';

export default function Home() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [counts, setCounts] = useState({ territories: 0, prospects: 0, campaigns: 0 });

  useEffect(() => {
    if (user) {
      loadCounts();
    }
  }, [user]);

  async function loadCounts() {
    if (!user) return;
    const [territories, prospects, campaigns] = await Promise.all([
      getTerritories(user.uid),
      getProspects(user.uid),
      getCampaigns(user.uid),
    ]);
    setCounts({
      territories: territories.filter(t => t.status === 'active').length,
      prospects: prospects.length,
      campaigns: campaigns.filter(c => c.status !== 'completed').length,
    });
  }

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
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900">Territories</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{counts.territories}</p>
              <p className="text-gray-500 text-sm mt-1">Active markets</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900">Prospects</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">{counts.prospects}</p>
              <p className="text-gray-500 text-sm mt-1">Total leads</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900">Campaigns</h3>
              <p className="text-3xl font-bold text-purple-600 mt-2">{counts.campaigns}</p>
              <p className="text-gray-500 text-sm mt-1">Active campaigns</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
