'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { EmailTemplate, getEmailTemplates, addEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '@/lib/firestore';

type TemplateCategory = 'intro' | 'followup' | 'proposal' | 'other';

interface FormData {
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
}

const emptyForm: FormData = {
  name: '',
  subject: '',
  body: '',
  category: 'intro',
};

export default function TemplatesPage() {
  const { user, loading, logout } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  async function loadTemplates() {
    if (!user) return;
    const data = await getEmailTemplates(user.uid);
    setTemplates(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (editing) {
      await updateEmailTemplate(editing.id!, formData);
    } else {
      await addEmailTemplate({ ...formData, userId: user.uid });
    }

    setShowForm(false);
    setEditing(null);
    setFormData(emptyForm);
    loadTemplates();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this template?')) {
      await deleteEmailTemplate(id);
      loadTemplates();
    }
  }

  function openEdit(template: EmailTemplate) {
    setEditing(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
    });
    setShowForm(true);
    setPreview(null);
  }

  function resetForm() {
    setShowForm(true);
    setEditing(null);
    setFormData(emptyForm);
    setPreview(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const categoryColors: Record<string, string> = {
    intro: 'bg-blue-100 text-blue-700',
    followup: 'bg-yellow-100 text-yellow-700',
    proposal: 'bg-purple-100 text-purple-700',
    other: 'bg-gray-100 text-gray-700',
  };

  // Filter and search
  const filteredTemplates = templates.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(query) || 
             t.subject.toLowerCase().includes(query) ||
             t.body.toLowerCase().includes(query);
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
            <h2 className="text-2xl font-bold text-gray-900">Email Templates</h2>
            <button onClick={resetForm} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              + New Template
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-64"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                <option value="intro">Introduction</option>
                <option value="followup">Follow-up</option>
                <option value="proposal">Proposal</option>
                <option value="other">Other</option>
              </select>
              <span className="text-sm text-gray-500">
                Showing {filteredTemplates.length} of {templates.length}
              </span>
            </div>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Template' : 'New Template'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Template Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., Initial Outreach"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as TemplateCategory })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="intro">Introduction</option>
                      <option value="followup">Follow-up</option>
                      <option value="proposal">Proposal</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., Grow Your Business with Direct Mail"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email Body
                    <span className="text-gray-400 font-normal ml-2">Use {'{business}'}, {'{contact}'}, {'{territory}'} for placeholders</span>
                  </label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                    rows={10}
                    placeholder={`Hi {contact},

I wanted to reach out about an opportunity to grow {business}'s visibility in the {territory} area...`}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {preview && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Preview: {preview.name}</h3>
                <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="mb-2">
                  <span className="text-sm text-gray-500">Subject:</span>
                  <span className="ml-2 font-medium">{preview.subject}</span>
                  <button 
                    onClick={() => copyToClipboard(preview.subject)}
                    className="ml-2 text-xs text-blue-600 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <hr className="my-3" />
                <div className="whitespace-pre-wrap text-sm">{preview.body}</div>
                <button 
                  onClick={() => copyToClipboard(preview.body)}
                  className="mt-4 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  {copied ? 'Copied!' : 'Copy Body'}
                </button>
              </div>
            </div>
          )}

          {filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">
                {templates.length === 0 ? 'No templates yet. Create your first email template.' : 'No templates match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((t) => (
                <div key={t.id} className="bg-white rounded-lg shadow-sm border p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium">{t.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">{t.subject}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${categoryColors[t.category]}`}>
                      {t.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">{t.body}</p>
                  <div className="flex gap-3 mt-4 pt-3 border-t">
                    <button onClick={() => setPreview(t)} className="text-blue-600 hover:underline text-sm">Preview</button>
                    <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-sm">Edit</button>
                    <button onClick={() => handleDelete(t.id!)} className="text-red-600 hover:underline text-sm">Delete</button>
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
