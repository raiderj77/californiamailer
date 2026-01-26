'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Prospect, getProspects, EmailTemplate, getEmailTemplates } from '@/lib/firestore';

export default function EmailPage() {
  const { user, loading, logout } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [p, t] = await Promise.all([
      getProspects(user.uid),
      getEmailTemplates(user.uid),
    ]);
    setProspects(p);
    setTemplates(t);
  }

  function handleProspectSelect(prospectId: string) {
    const prospect = prospects.find(p => p.id === prospectId);
    setSelectedProspect(prospect || null);
    if (prospect) {
      setTo(prospect.email);
      applyTemplate(selectedTemplate, prospect);
    }
  }

  function handleTemplateSelect(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template || null);
    if (template) {
      applyTemplate(template, selectedProspect);
    }
  }

  function applyTemplate(template: EmailTemplate | null, prospect: Prospect | null) {
    if (!template) return;
    
    let subjectText = template.subject;
    let bodyText = template.body;

    if (prospect) {
      subjectText = subjectText
        .replace(/{business}/g, prospect.businessName)
        .replace(/{contact}/g, prospect.contactName)
        .replace(/{territory}/g, prospect.territoryName);
      
      bodyText = bodyText
        .replace(/{business}/g, prospect.businessName)
        .replace(/{contact}/g, prospect.contactName)
        .replace(/{territory}/g, prospect.territoryName);
    }

    setSubject(subjectText);
    setBody(bodyText);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !subject || !body) return;

    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ success: true, message: `Email sent to ${to}!` });
        setTo('');
        setSubject('');
        setBody('');
        setSelectedProspect(null);
        setSelectedTemplate(null);
      } else {
        setResult({ success: false, message: 'Failed to send email. Please try again.' });
      }
    } catch (error) {
      setResult({ success: false, message: 'Error sending email.' });
    }

    setSending(false);
  }

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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Email</h2>

          {result && (
            <div className={`p-4 rounded-lg mb-6 ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.message}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Select Prospect</label>
                <select
                  value={selectedProspect?.id || ''}
                  onChange={(e) => handleProspectSelect(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Choose a prospect...</option>
                  {prospects.filter(p => p.email).map((p) => (
                    <option key={p.id} value={p.id}>{p.businessName} ({p.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Use Template</label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Choose a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">To</label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Email subject..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={12}
                  placeholder="Write your message..."
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sending || !to || !subject || !body}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
