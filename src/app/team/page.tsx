'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { TeamMember, getTeamMembers, addTeamMember, updateTeamMember, deleteTeamMember } from '@/lib/firestore';

type MemberRole = 'admin' | 'editor' | 'viewer';

interface FormData {
  email: string;
  name: string;
  role: MemberRole;
}

const emptyForm: FormData = {
  email: '',
  name: '',
  role: 'viewer',
};

export default function TeamPage() {
  const { user, loading, logout } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  useEffect(() => {
    if (user) {
      loadMembers();
    }
  }, [user]);

  async function loadMembers() {
    if (!user) return;
    const data = await getTeamMembers(user.uid);
    setMembers(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    await addTeamMember({
      ...formData,
      status: 'pending',
      ownerId: user.uid,
    });

    setShowForm(false);
    setFormData(emptyForm);
    loadMembers();
  }

  async function handleDelete(id: string) {
    if (confirm('Remove this team member?')) {
      await deleteTeamMember(id);
      loadMembers();
    }
  }

  async function updateRole(member: TeamMember, role: MemberRole) {
    await updateTeamMember(member.id!, { role });
    loadMembers();
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    editor: 'bg-blue-100 text-blue-700',
    viewer: 'bg-gray-100 text-gray-700',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
  };

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
              <h2 className="text-2xl font-bold text-gray-900">Team</h2>
              <p className="text-sm text-gray-500">Manage team member access</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              + Invite Member
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-800 mb-2">Role Permissions</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li><strong>Admin:</strong> Full access - can manage team, edit all data</li>
              <li><strong>Editor:</strong> Can create and edit territories, prospects, campaigns</li>
              <li><strong>Viewer:</strong> Read-only access to all data</li>
            </ul>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">Invite Team Member</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
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
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as MemberRole })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                    Send Invite
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Owner Card */}
          <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium">{user.email}</h4>
                  <p className="text-sm text-gray-500">Account Owner</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-700">
                Owner
              </span>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No team members yet. Invite someone to collaborate.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((m) => (
                <div key={m.id} className="bg-white rounded-lg shadow-sm border p-5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">{m.name}</h4>
                        <p className="text-sm text-gray-500">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[m.status]}`}>
                        {m.status}
                      </span>
                      <select
                        value={m.role}
                        onChange={(e) => updateRole(m, e.target.value as MemberRole)}
                        className={`px-2 py-1 rounded text-xs border-0 ${roleColors[m.role]}`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleDelete(m.id!)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Remove
                      </button>
                    </div>
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
