'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Campaign, getCampaigns } from '@/lib/firestore';

export default function CalendarPage() {
  const { user, loading, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  async function loadCampaigns() {
    if (!user) return;
    const data = await getCampaigns(user.uid);
    setCampaigns(data);
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function getCampaignsForDate(date: number): Campaign[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return campaigns.filter(c => c.mailDate === dateStr);
  }

  const typeColors: Record<string, string> = {
    eddm: 'bg-blue-500',
    coop: 'bg-purple-500',
    solo: 'bg-orange-500',
  };

  const today = new Date();
  const isToday = (date: number) => 
    today.getFullYear() === year && 
    today.getMonth() === month && 
    today.getDate() === date;

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
            <h2 className="text-2xl font-bold text-gray-900">Campaign Calendar</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 bg-blue-500 rounded"></span> EDDM
                <span className="w-3 h-3 bg-purple-500 rounded ml-2"></span> Co-op
                <span className="w-3 h-3 bg-orange-500 rounded ml-2"></span> Solo
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            {/* Calendar Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <button
                onClick={prevMonth}
                className="px-3 py-1 rounded hover:bg-gray-100"
              >
                ← Prev
              </button>
              <h3 className="text-lg font-medium">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={nextMonth}
                className="px-3 py-1 rounded hover:bg-gray-100"
              >
                Next →
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {/* Empty cells for padding */}
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="min-h-24 p-2 border-b border-r bg-gray-50"></div>
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const date = i + 1;
                const dayCampaigns = getCampaignsForDate(date);
                
                return (
                  <div
                    key={date}
                    className={`min-h-24 p-2 border-b border-r ${
                      isToday(date) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`text-sm mb-1 ${
                      isToday(date) ? 'font-bold text-blue-600' : 'text-gray-700'
                    }`}>
                      {date}
                    </div>
                    <div className="space-y-1">
                      {dayCampaigns.map(c => (
                        <div
                          key={c.id}
                          className={`text-xs text-white px-1 py-0.5 rounded truncate ${typeColors[c.type]}`}
                          title={`${c.name} - ${c.quantity.toLocaleString()} pcs`}
                        >
                          {c.name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Trailing empty cells */}
              {Array.from({ length: (7 - ((startPadding + daysInMonth) % 7)) % 7 }).map((_, i) => (
                <div key={`trail-${i}`} className="min-h-24 p-2 border-b border-r bg-gray-50"></div>
              ))}
            </div>
          </div>

          {/* Upcoming Campaigns List */}
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-5">
            <h3 className="text-lg font-medium mb-4">Upcoming Mail Dates</h3>
            {campaigns.filter(c => c.mailDate && c.mailDate >= new Date().toISOString().split('T')[0]).length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming campaigns scheduled</p>
            ) : (
              <div className="space-y-2">
                {campaigns
                  .filter(c => c.mailDate && c.mailDate >= new Date().toISOString().split('T')[0])
                  .sort((a, b) => a.mailDate.localeCompare(b.mailDate))
                  .slice(0, 10)
                  .map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                      <span className={`w-3 h-3 rounded ${typeColors[c.type]}`}></span>
                      <span className="font-medium">{c.mailDate}</span>
                      <span className="text-gray-600">{c.name}</span>
                      <span className="text-gray-400 text-sm">{c.quantity.toLocaleString()} pcs</span>
                      <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                        c.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        c.status === 'mailed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
