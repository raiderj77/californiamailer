import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Offer {
  code: string;
  businessName: string;
  businessLogo?: string;
  headline: string;
  description: string;
  discount: string;
  terms: string;
  expirationDate: string;
  phone?: string;
  website?: string;
  address?: string;
  campaignId: string;
  category: string;
  cta: string;
  backgroundColor: string;
  accentColor: string;
}

// Demo data - in production this would come from Firestore
const offers: Record<string, Offer> = {
  'ACME20': {
    code: 'ACME20',
    businessName: 'Acme Plumbing',
    headline: '$20 OFF Any Service Call',
    description: 'Professional plumbing services for your home. Licensed, bonded, and insured. Same-day service available!',
    discount: '$20 OFF',
    terms: 'Valid for new customers only. Cannot be combined with other offers. One coupon per household.',
    expirationDate: '2026-03-31',
    phone: '(831) 555-1234',
    website: 'www.acmeplumbing.com',
    address: '123 Main St, Salinas, CA 93901',
    campaignId: 'SAL48-07',
    category: 'Plumbing',
    cta: 'Call Now to Schedule',
    backgroundColor: 'from-blue-600 to-blue-800',
    accentColor: 'blue',
  },
  'SUNRISE50': {
    code: 'SUNRISE50',
    businessName: 'Sunrise Dental',
    headline: '$50 OFF New Patient Exam',
    description: 'Complete dental exam, x-rays, and cleaning. State-of-the-art facility with gentle, caring dentists.',
    discount: '$50 OFF',
    terms: 'New patients only. Includes exam, x-rays, and cleaning. Insurance accepted.',
    expirationDate: '2026-04-15',
    phone: '(831) 555-5678',
    website: 'www.sunrisedental.com',
    address: '456 Ocean Ave, Monterey, CA 93940',
    campaignId: 'MON22-03',
    category: 'Dental',
    cta: 'Book Your Appointment',
    backgroundColor: 'from-teal-500 to-teal-700',
    accentColor: 'teal',
  },
  'GREEN15': {
    code: 'GREEN15',
    businessName: 'Green Valley Landscaping',
    headline: '15% OFF Spring Cleanup',
    description: 'Full-service landscaping including lawn care, tree trimming, and irrigation. Transform your outdoor space!',
    discount: '15% OFF',
    terms: 'Valid for services over $200. Cannot be combined with other offers.',
    expirationDate: '2026-04-30',
    phone: '(831) 555-9012',
    website: 'www.greenvalleylandscaping.com',
    address: '789 Garden Rd, Carmel, CA 93923',
    campaignId: 'CAR12-01',
    category: 'Landscaping',
    cta: 'Get Free Estimate',
    backgroundColor: 'from-green-500 to-green-700',
    accentColor: 'green',
  },
  'PIZZA599': {
    code: 'PIZZA599',
    businessName: "Tony's Pizza",
    headline: 'Large Pizza Only $5.99',
    description: 'Hand-tossed, fresh ingredients, made to order. Family owned since 1985!',
    discount: '$5.99',
    terms: 'Pickup only. One per customer per visit. Toppings extra.',
    expirationDate: '2026-02-28',
    phone: '(831) 555-3456',
    website: 'www.tonyspizzasalinas.com',
    address: '321 Pizza Lane, Salinas, CA 93901',
    campaignId: 'SAL48-07',
    category: 'Restaurant',
    cta: 'Order Now',
    backgroundColor: 'from-red-500 to-red-700',
    accentColor: 'red',
  },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function OfferPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const offer = offers[code.toUpperCase()];

  if (!offer) {
    notFound();
  }

  const today = new Date();
  const expDate = new Date(offer.expirationDate);
  const isExpired = today > expDate;
  const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Banner */}
      <div className={`bg-gradient-to-r ${offer.backgroundColor} text-white py-12 px-4`}>
        <div className="max-w-lg mx-auto text-center">
          <div className="text-sm uppercase tracking-wider mb-2 opacity-80">{offer.category}</div>
          <h1 className="text-2xl font-bold mb-2">{offer.businessName}</h1>
          <div className="text-5xl font-black mb-4">{offer.discount}</div>
          <p className="text-xl">{offer.headline}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 -mt-8 relative">
          {/* Discount Badge */}
          <div 
            className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg"
            style={{ backgroundColor: offer.accentColor === 'blue' ? '#2563eb' : offer.accentColor === 'teal' ? '#0d9488' : offer.accentColor === 'green' ? '#16a34a' : '#dc2626' }}
          >
            EXCLUSIVE OFFER
          </div>

          {/* Description */}
          <div className="mt-4 mb-6">
            <p className="text-gray-600 text-center">{offer.description}</p>
          </div>

          {/* Expiration Warning */}
          {!isExpired && daysLeft <= 14 && (
            <div 
              className="border rounded-lg px-4 py-3 mb-6 text-center"
              style={{ 
                backgroundColor: offer.accentColor === 'blue' ? '#eff6ff' : offer.accentColor === 'teal' ? '#f0fdfa' : offer.accentColor === 'green' ? '#f0fdf4' : '#fef2f2',
                borderColor: offer.accentColor === 'blue' ? '#bfdbfe' : offer.accentColor === 'teal' ? '#99f6e4' : offer.accentColor === 'green' ? '#bbf7d0' : '#fecaca',
                color: offer.accentColor === 'blue' ? '#1e40af' : offer.accentColor === 'teal' ? '#115e59' : offer.accentColor === 'green' ? '#166534' : '#991b1b'
              }}
            >
              ⏰ Only <strong>{daysLeft} days</strong> left to redeem this offer!
            </div>
          )}

          {isExpired && (
            <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-lg px-4 py-3 mb-6 text-center">
              This offer expired on {formatDate(offer.expirationDate)}
            </div>
          )}

          {/* Code Display */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center mb-6">
            <div className="text-sm text-gray-500 mb-1">Your Offer Code</div>
            <div className="text-3xl font-mono font-bold tracking-wider text-gray-900">{offer.code}</div>
            <div className="text-sm text-gray-500 mt-2">Show this code when you visit or call</div>
          </div>

          {/* CTA Button */}
          {!isExpired && offer.phone && (
            <a
              href={`tel:${offer.phone.replace(/[^0-9]/g, '')}`}
              className="block w-full text-white text-center py-4 rounded-xl font-bold text-lg mb-6 transition-colors"
              style={{ backgroundColor: offer.accentColor === 'blue' ? '#2563eb' : offer.accentColor === 'teal' ? '#0d9488' : offer.accentColor === 'green' ? '#16a34a' : '#dc2626' }}
            >
              📞 {offer.cta}: {offer.phone}
            </a>
          )}

          {/* Business Info */}
          <div className="border-t pt-6 space-y-3 text-sm">
            {offer.address && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400">📍</span>
                <span>{offer.address}</span>
              </div>
            )}
            {offer.phone && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400">📞</span>
                <a href={`tel:${offer.phone.replace(/[^0-9]/g, '')}`} className="text-blue-600 hover:underline">
                  {offer.phone}
                </a>
              </div>
            )}
            {offer.website && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400">🌐</span>
                <a href={`https://${offer.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {offer.website}
                </a>
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="mt-6 pt-6 border-t">
            <div className="text-xs text-gray-500">
              <strong>Terms & Conditions:</strong> {offer.terms} Expires {formatDate(offer.expirationDate)}.
            </div>
          </div>
        </div>

        {/* Powered By */}
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">
            This offer brought to you by{' '}
            <Link href="/home" className="text-blue-600 hover:underline">
              CaliforniaMailer
            </Link>
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Direct mail that delivers results
          </p>
        </div>
      </div>
    </div>
  );
}
