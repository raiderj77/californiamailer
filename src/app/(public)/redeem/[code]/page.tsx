'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getOfferByCode, addRedemption, updateOffer, Offer } from '@/lib/firestore';

export default function RedeemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
  });

  useEffect(() => {
    loadOffer();
  }, [code]);

  async function loadOffer() {
    try {
      const data = await getOfferByCode(code);
      if (!data) {
        setError('Offer not found');
        setLoading(false);
        return;
      }
      setOffer(data);
    } catch (err) {
      console.error('Error:', err);
      setError('Error loading offer');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!offer || !offer.id) return;

    setSubmitting(true);
    try {
      // Log redemption
      await addRedemption({
        offerId: offer.id,
        offerCode: offer.code,
        businessName: offer.businessName,
        customerName: formData.customerName || undefined,
        customerPhone: formData.customerPhone || undefined,
        customerEmail: formData.customerEmail || undefined,
        notes: formData.notes || undefined,
      });

      // Increment redemption count
      await updateOffer(offer.id, {
        redemptions: (offer.redemptions || 0) + 1,
      });

      setSuccess(true);
      setFormData({ customerName: '', customerPhone: '', customerEmail: '', notes: '' });
    } catch (err) {
      console.error('Error submitting redemption:', err);
      alert('Failed to record redemption. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center text-center">
        <div>
          <div className="text-6xl mb-4">🎟️</div>
          <h1 className="text-2xl font-bold mb-2">Offer Not Found</h1>
          <p className="text-gray-500 mb-6">Code &quot;{code}&quot; is invalid or expired.</p>
          <Link href="/home" className="text-blue-600 hover:underline">Return Home</Link>
        </div>
      </div>
    );
  }

  const today = new Date();
  const expDate = new Date(offer.expirationDate);
  const isExpired = today > expDate;

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center text-center">
        <div>
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold mb-2">Offer Expired</h1>
          <p className="text-gray-500 mb-6">This offer expired on {expDate.toLocaleDateString()}</p>
          <Link href="/home" className="text-blue-600 hover:underline">Return Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/home" className="text-xl font-bold">CaliforniaMailer</Link>
          <span className="text-blue-200 text-sm">Redeem Offer</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">Redeeming Offer</div>
            <h1 className="text-2xl font-bold">{offer.businessName}</h1>
            <div className="text-3xl font-black text-blue-600 my-3">{offer.discount}</div>
            <div className="text-gray-600">{offer.headline}</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
            <div className="text-sm text-blue-600 mb-1">Offer Code</div>
            <div className="text-2xl font-mono font-bold text-blue-900">{offer.code}</div>
          </div>

          <div className="flex justify-between text-sm text-gray-600 mb-6 pb-6 border-b">
            <div>
              <span className="text-gray-400">📊 </span>
              <strong>{offer.redemptions || 0}</strong> redemptions
            </div>
            <div>
              <span className="text-gray-400">👁️ </span>
              <strong>{offer.views || 0}</strong> views
            </div>
            <div>
              <span className="text-gray-400">📅 </span>
              Expires {expDate.toLocaleDateString()}
            </div>
          </div>

          {success ? (
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Redemption Recorded!</h3>
              <p className="text-green-600 mb-4">Thank you for using CaliforniaMailer.</p>
              <button
                onClick={() => setSuccess(false)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700"
              >
                Record Another Redemption
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Phone <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="(831) 555-0123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Email <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    rows={3}
                    placeholder="Any additional details..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold mt-6 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Recording...' : '✓ Confirm Redemption'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                By confirming, you acknowledge this customer has redeemed this offer.
              </p>
            </form>
          )}
        </div>

        <div className="text-center">
          <Link href={`/offer/${code}`} className="text-blue-600 hover:underline text-sm">
            ← View Offer Page
          </Link>
        </div>
      </main>
    </div>
  );
}
