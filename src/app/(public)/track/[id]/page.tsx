import Link from 'next/link';
import { notFound } from 'next/navigation';

interface CampaignStatus {
  id: string;
  businessName: string;
  campaignName: string;
  territory: string;
  quantity: number;
  mailDate: string;
  status: 'design' | 'proof' | 'approved' | 'printing' | 'shipping' | 'delivered' | 'in-homes';
  statusHistory: { status: string; date: string; note?: string }[];
  spotNumber?: number;
  cardSize: string;
  type: 'coop' | 'eddm' | 'solo';
}

// Demo data - in production this would come from Firestore
const campaigns: Record<string, CampaignStatus> = {
  'SAL48-07': {
    id: 'SAL48-07',
    businessName: 'Acme Plumbing',
    campaignName: 'Salinas #48',
    territory: 'Creekbridge / Santa Rita',
    quantity: 12500,
    mailDate: '2026-02-15',
    status: 'printing',
    spotNumber: 7,
    cardSize: '9x12',
    type: 'coop',
    statusHistory: [
      { status: 'reserved', date: '2026-01-10', note: 'Spot reserved' },
      { status: 'design', date: '2026-01-12', note: 'Design started' },
      { status: 'proof', date: '2026-01-14', note: 'Proof sent for review' },
      { status: 'approved', date: '2026-01-15', note: 'Design approved by client' },
      { status: 'printing', date: '2026-01-20', note: 'Sent to print facility' },
    ],
  },
  'MON22-03': {
    id: 'MON22-03',
    businessName: 'Sunrise Dental',
    campaignName: 'Monterey #22',
    territory: 'Del Monte / New Monterey',
    quantity: 8200,
    mailDate: '2026-02-20',
    status: 'proof',
    spotNumber: 3,
    cardSize: '9x12',
    type: 'coop',
    statusHistory: [
      { status: 'reserved', date: '2026-01-15', note: 'Spot reserved' },
      { status: 'design', date: '2026-01-18', note: 'Design started' },
      { status: 'proof', date: '2026-01-22', note: 'Proof sent for review' },
    ],
  },
  'EDDM-1042': {
    id: 'EDDM-1042',
    businessName: 'Green Valley Landscaping',
    campaignName: 'Carmel Valley EDDM',
    territory: 'Carmel Valley Village',
    quantity: 5000,
    mailDate: '2026-02-10',
    status: 'in-homes',
    cardSize: '6.5x11',
    type: 'eddm',
    statusHistory: [
      { status: 'ordered', date: '2026-01-05', note: 'Order placed' },
      { status: 'design', date: '2026-01-06', note: 'Design started' },
      { status: 'proof', date: '2026-01-08', note: 'Proof sent' },
      { status: 'approved', date: '2026-01-09', note: 'Approved' },
      { status: 'printing', date: '2026-01-12', note: 'Printing' },
      { status: 'shipping', date: '2026-01-15', note: 'Shipped to USPS' },
      { status: 'delivered', date: '2026-01-18', note: 'Delivered to Post Office' },
      { status: 'in-homes', date: '2026-02-10', note: 'Mail date reached - in mailboxes!' },
    ],
  },
};

const statusSteps = [
  { key: 'design', label: 'Design', icon: '🎨' },
  { key: 'proof', label: 'Proof Review', icon: '👁️' },
  { key: 'approved', label: 'Approved', icon: '✅' },
  { key: 'printing', label: 'Printing', icon: '🖨️' },
  { key: 'shipping', label: 'Shipping', icon: '📦' },
  { key: 'delivered', label: 'At Post Office', icon: '🏤' },
  { key: 'in-homes', label: 'In Mailboxes!', icon: '📬' },
];

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = campaigns[id.toUpperCase()];

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link href="/home" className="text-2xl font-bold text-blue-600">CaliforniaMailer</Link>
          </div>
        </nav>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn't find a campaign with tracking ID: <strong>{id}</strong>
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Check your confirmation email for the correct tracking link, or contact us for help.
          </p>
          <Link href="/home" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = statusSteps.findIndex((s) => s.key === campaign.status);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-homes': return 'bg-green-500';
      case 'delivered': return 'bg-green-400';
      case 'shipping': return 'bg-blue-500';
      case 'printing': return 'bg-purple-500';
      case 'approved': return 'bg-teal-500';
      case 'proof': return 'bg-yellow-500';
      case 'design': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold text-blue-600">CaliforniaMailer</Link>
          <Link href="/home" className="text-gray-500 hover:text-gray-700 text-sm">← Back to Home</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Tracking ID: {campaign.id}</div>
              <h1 className="text-2xl font-bold">{campaign.businessName}</h1>
              <p className="text-gray-600">{campaign.campaignName} • {campaign.territory}</p>
            </div>
            <div className={`${getStatusColor(campaign.status)} text-white px-4 py-2 rounded-lg font-medium`}>
              {statusSteps.find((s) => s.key === campaign.status)?.icon}{' '}
              {statusSteps.find((s) => s.key === campaign.status)?.label}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="font-bold mb-6">Campaign Progress</h2>
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded">
              <div
                className="h-1 bg-blue-600 rounded transition-all duration-500"
                style={{ width: `${((currentStepIndex + 1) / statusSteps.length) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between">
              {statusSteps.map((step, index) => {
                const isComplete = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <div key={step.key} className="flex flex-col items-center" style={{ width: '14%' }}>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg z-10 ${
                        isComplete
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}
                    >
                      {step.icon}
                    </div>
                    <div className={`text-xs mt-2 text-center ${isComplete ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Campaign Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-bold mb-4">Campaign Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Type:</dt>
                <dd className="font-medium capitalize">{campaign.type === 'coop' ? 'Co-op Postcard' : campaign.type.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Card Size:</dt>
                <dd className="font-medium">{campaign.cardSize}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Quantity:</dt>
                <dd className="font-medium">{campaign.quantity.toLocaleString()} pieces</dd>
              </div>
              {campaign.spotNumber && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Spot Number:</dt>
                  <dd className="font-medium">#{campaign.spotNumber}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Territory:</dt>
                <dd className="font-medium">{campaign.territory}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Mail Date:</dt>
                <dd className="font-medium text-blue-600">{formatDate(campaign.mailDate)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-bold mb-4">Activity Timeline</h2>
            <div className="space-y-4">
              {campaign.statusHistory.slice().reverse().map((item, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                  <div>
                    <div className="font-medium text-sm">{item.note}</div>
                    <div className="text-xs text-gray-500">{formatDate(item.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Help Box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
          <h3 className="font-bold mb-2">Questions About Your Campaign?</h3>
          <p className="text-gray-600 text-sm mb-4">
            We're here to help! Contact us if you have any questions about your mailing.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>📧 hello@californiamailer.com</span>
            <span>📞 (831) 555-0100</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm">
          <p>© {new Date().getFullYear()} CaliforniaMailer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
