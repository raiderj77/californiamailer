'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getOfferByCode, incrementOfferViews, Offer } from '@/lib/firestore';

export default function OfferPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (data.id) {
        incrementOfferViews(data.id).catch(console.error);
      }
    } catch (err) {
      console.error('Error loading offer:', err);
      setError('Error loading offer');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function getAccentColor(color: string): string {
    const colors: Record<string, string> = { blue: '#2563eb', teal: '#0d9488', green: '#16a34a', red: '#dc2626', purple: '#9333ea', orange: '#ea580c' };
    return colors[color] || colors.blue;
  }

  function getGradient(color: string): string {
    const gradients: Record<string, string> = { blue: 'from-blue-600 to-blue-800', teal: 'from-teal-500 to-teal-700', green: 'from-green-500 to-green-700', red: 'from-red-500 to-red-700', purple: 'from-purple-500 to-purple-700', orange: 'from-orange-500 to-orange-700' };
    return gradients[color] || gradients.blue;
  }

  function getAccentBg(color: string): { bg: string; border: string; text: string } {
    const styles: Record<string, { bg: string; border: string; text: string }> = {
      blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
      teal: { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59' },
      green: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
      red: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
      purple: { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' },
      orange: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
    };
    return styles[color] || styles.blue;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading offer...</p>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎟️</div>
          <h1 className="text-2xl font-bold mb-2">Offer Not Found</h1>
          <p className="text-gray-500 mb-6">The offer code &quot;{code}&quot; is not valid or has expired.</p>
          <Link href="/home" className="text-blue-600 hover:underline">Return to Homepage</Link>
        </div>
      </div>
    );
  }

  const today = new Date();
  const expDate = new Date(offer.expirationDate);
  const isExpired = today > expDate;
  const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const accentColor = getAccentColor(offer.accentColor);
  const accentStyles = getAccentBg(offer.accentColor);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className={`bg-gradient-to-r ${getGradient(offer.accentColor)} text-white py-12 px-4`}>
        <div className="max-w-lg mx-auto text-center">
          <div className="text-sm uppercase tracking-wider mb-2 opacity-80">{offer.category}</div>
          <h1 className="text-2xl font-bold mb-2">{offer.businessName}</h1>
          <div className="text-5xl font-black mb-4">{offer.discount}</div>
          <p className="text-xl">{offer.headline}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 -mt-8 relative">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg" style={{ backgroundColor: accentColor }}>EXCLUSIVE OFFER</div>
          <div className="mt-4 mb-6"><p className="text-gray-600 text-center">{offer.description}</p></div>

          {!isExpired && daysLeft <= 14 && (
            <div className="border rounded-lg px-4 py-3 mb-6 text-center" style={{ backgroundColor: accentStyles.bg, borderColor: accentStyles.border, color: accentStyles.text }}>
              ⏰ Only <strong>{daysLeft} days</strong> left to redeem this offer!
            </div>
          )}

          {isExpired && (
            <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-lg px-4 py-3 mb-6 text-center">
              This offer expired on {formatDate(offer.expirationDate)}
            </div>
          )}

          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center mb-6">
            <div className="text-sm text-gray-500 mb-1">Your Offer Code</div>
            <div className="text-3xl font-mono font-bold tracking-wider text-gray-900">{offer.code}</div>
            <div className="text-sm text-gray-500 mt-2">Show this code when you visit or call</div>
          </div>

          {!isExpired && offer.phone && (
            <a href={`tel:${offer.phone.replace(/[^0-9]/g, '')}`} className="block w-full text-white text-center py-4 rounded-xl font-bold text-lg mb-6 transition-colors hover:opacity-90" style={{ backgroundColor: accentColor }}>
              📞 {offer.cta}: {offer.phone}
            </a>
          )}

          <div className="border-t pt-6 space-y-3 text-sm">
            {offer.address && (<div className="flex items-start gap-3"><span className="text-gray-400">📍</span><span>{offer.address}</span></div>)}
            {offer.phone && (<div className="flex items-start gap-3"><span className="text-gray-400">📞</span><a href={`tel:${offer.phone.replace(/[^0-9]/g, '')}`} className="text-blue-600 hover:underline">{offer.phone}</a></div>)}
            {offer.website && (<div className="flex items-start gap-3"><span className="text-gray-400">🌐</span><a href={`https://${offer.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{offer.website}</a></div>)}
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="text-xs text-gray-500"><strong>Terms & Conditions:</strong> {offer.terms} Expires {formatDate(offer.expirationDate)}.</div>
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">This offer brought to you by{' '}<Link href="/home" className="text-blue-600 hover:underline">CaliforniaMailer</Link></p>
          <p className="text-gray-400 text-xs mt-1">Direct mail that delivers results</p>
        </div>
      </div>
    </div>
  );
}
