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

  useEffect(() => {
    loadProof();
  }, [id]);

  async function loadProof() {
    try {
      const data = await getProof(id);
      if (!data) {
        setError('Proof not found');
        setLoading(false);
        return;
      }
      setProof(data);
    } catch (err) {
      console.error('Error loading proof:', err);
      setError('Error loading proof');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!proof?.id) return;
    if (!confirm('Are you sure you want to approve this proof? This will authorize us to proceed with printing.')) return;
    
    setSubmitting(true);
    try {
      await approveProof(proof.id, proof.clientName);
      setSubmitted('approved');
    } catch (err) {
      console.error('Error approving:', err);
      alert('Error submitting approval. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!proof?.id || !feedback.trim()) return;
    
    setSubmitting(true);
    try {
      await requestProofRevision(proof.id, feedback);
      setSubmitted('revision');
    } catch (err) {
      console.error('Error requesting revision:', err);
      alert('Error submitting revision request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading proof...</p>
        </div>
      </div>
    );
  }

  if (error || !proof) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-2xl font-bold mb-2">Proof Not Found</h1>
          <p className="text-gray-500 mb-6">This proof link may be expired or invalid.</p>
          <Link href="/home" className="text-blue-600 hover:underline">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          {submitted === 'approved' ? (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Proof Approved!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for approving your proof. We will now proceed with printing and mailing your campaign.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Revision Requested</h1>
              <p className="text-gray-600 mb-6">
                We have received your feedback and will make the requested changes. You will receive a new proof soon.
              </p>
            </>
          )}
          <Link
            href="/home"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (proof.status === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Approved</h1>
          <p className="text-gray-600 mb-6">
            This proof has already been approved and is being processed.
          </p>
          <Link
            href="/home"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/home" className="text-xl font-bold text-blue-600">
            CaliforniaMailer
          </Link>
          <span className="text-sm text-gray-500">Proof Approval</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Campaign Info */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{proof.campaignName}</h1>
              <p className="text-gray-500">Version {proof.version}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Client</div>
              <div className="font-semibold">{proof.clientName}</div>
            </div>
          </div>
        </div>

        {/* Proof Preview */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Your Proof</h2>
          
          <div className="bg-gray-100 rounded-lg p-8 text-center mb-4">
            {proof.thumbnailUrl ? (
              <img 
                src={proof.thumbnailUrl} 
                alt="Proof preview" 
                className="max-w-full max-h-96 mx-auto rounded-lg shadow"
              />
            ) : (
              <div className="text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Preview not available</p>
              </div>
            )}
          </div>

          <a
            href={proof.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Full Proof (PDF)
          </a>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Your Decision</h2>
          <p className="text-gray-600 mb-6">
            Please review the proof carefully. Once approved, we will proceed with printing. If you need changes, please request a revision with specific feedback.
          </p>

          {!showRevisionForm ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Approve Proof
              </button>
              <button
                onClick={() => setShowRevisionForm(true)}
                disabled={submitting}
                className="flex-1 border-2 border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-50 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Request Revision
              </button>
            </div>
          ) : (
            <form onSubmit={handleRevision}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What changes would you like?
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3 h-32 resize-none"
                  placeholder="Please be as specific as possible about the changes you need..."
                  required
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowRevisionForm(false)}
                  className="flex-1 border rounded-xl py-3 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !feedback.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Revision Request'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Help */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Questions about your proof? Email us at support@californiamailer.com
        </div>
      </main>
    </div>
  );
}
