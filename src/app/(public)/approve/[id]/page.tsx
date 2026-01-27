'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getProof, approveProof, requestProofRevision, Proof } from '@/lib/firestore';

export default function ProofApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [proof, setProof] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'revision' | null>(null);

  useEffect(() => { loadProof(); }, [id]);

  async function loadProof() {
    try {
      const data = await getProof(id);
      if (!data) { setError('Proof not found'); setLoading(false); return; }
      setProof(data);
    } catch (err) { console.error('Error:', err); setError('Error loading proof'); } 
    finally { setLoading(false); }
  }

  async function handleApprove() {
    if (!proof?.id || !confirm('Approve this proof? This authorizes printing.')) return;
    setSubmitting(true);
    try { await approveProof(proof.id, proof.clientName); setSubmitted('approved'); } 
    catch (err) { console.error('Error:', err); alert('Error submitting. Please try again.'); } 
    finally { setSubmitting(false); }
  }

  async function handleRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!proof?.id || !feedback.trim()) return;
    setSubmitting(true);
    try { await requestProofRevision(proof.id, feedback); setSubmitted('revision'); } 
    catch (err) { console.error('Error:', err); alert('Error submitting. Please try again.'); } 
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (error || !proof) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center"><div className="text-6xl mb-4">📋</div><h1 className="text-2xl font-bold mb-2">Proof Not Found</h1><p className="text-gray-500 mb-6">This link may be expired.</p><Link href="/home" className="text-blue-600">Return Home</Link></div>;

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className={`w-20 h-20 ${submitted === 'approved' ? 'bg-green-100' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
          {submitted === 'approved' ? <span className="text-4xl">✅</span> : <span className="text-4xl">📝</span>}
        </div>
        <h1 className="text-2xl font-bold mb-2">{submitted === 'approved' ? 'Proof Approved!' : 'Revision Requested'}</h1>
        <p className="text-gray-600 mb-6">{submitted === 'approved' ? 'We will proceed with printing.' : 'We will make changes and send a new proof.'}</p>
        <Link href="/home" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">Return Home</Link>
      </div>
    </div>
  );

  if (proof.status === 'approved') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
        <h1 className="text-2xl font-bold mb-2">Already Approved</h1>
        <p className="text-gray-600 mb-6">This proof has been approved and is being processed.</p>
        <Link href="/home" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">Return Home</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b"><div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center"><Link href="/home" className="text-xl font-bold text-blue-600">CaliforniaMailer</Link><span className="text-sm text-gray-500">Proof Approval</span></div></header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="flex justify-between items-start">
            <div><h1 className="text-2xl font-bold">{proof.campaignName}</h1><p className="text-gray-500">Version {proof.version}</p></div>
            <div className="text-right"><div className="text-sm text-gray-500">Client</div><div className="font-semibold">{proof.clientName}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Your Proof</h2>
          <div className="bg-gray-100 rounded-lg p-8 text-center mb-4">
            {proof.thumbnailUrl ? <img src={proof.thumbnailUrl} alt="Proof" className="max-w-full max-h-96 mx-auto rounded-lg shadow" /> : <div className="text-gray-400 py-12"><span className="text-6xl">📄</span><p className="mt-4">Preview not available</p></div>}
          </div>
          <a href={proof.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold">📥 Download Full Proof (PDF)</a>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Your Decision</h2>
          <p className="text-gray-600 mb-6">Review carefully. Once approved, we proceed with printing.</p>
          {!showRevisionForm ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleApprove} disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-4 rounded-xl font-bold text-lg">✅ Approve Proof</button>
              <button onClick={() => setShowRevisionForm(true)} disabled={submitting} className="flex-1 border-2 border-orange-500 text-orange-600 hover:bg-orange-50 py-4 rounded-xl font-bold text-lg">📝 Request Revision</button>
            </div>
          ) : (
            <form onSubmit={handleRevision}>
              <div className="mb-4"><label className="block text-sm font-medium mb-2">What changes do you need?</label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full border rounded-lg px-4 py-3 h-32" placeholder="Be specific about changes..." required /></div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowRevisionForm(false)} className="flex-1 border rounded-xl py-3 font-semibold">Cancel</button>
                <button type="submit" disabled={submitting || !feedback.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 rounded-xl font-semibold">{submitting ? 'Submitting...' : 'Submit Revision'}</button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">Questions? Email support@californiamailer.com</div>
      </main>
    </div>
  );
}
