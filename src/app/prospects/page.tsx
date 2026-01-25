'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';

export default function ProspectsPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Please sign in</p>
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
              <button onClick={logout} className="text-gray-500 hover:text-gray-700">
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Prospects</h2>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              + Add Prospect
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <p className="text-gray-500">No prospects yet. Add your first lead.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
