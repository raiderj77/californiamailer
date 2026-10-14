import Link from 'next/link';

// This page has no trusted payment verification source. A return URL or session
// identifier must never be treated as evidence of a payment or an accepted order.
export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment status unverified</h1>
        <p className="text-gray-700 mb-4">
          This page cannot verify a payment or confirm that an order was accepted.
          Online checkout is currently unavailable.
        </p>
        <p className="text-gray-700 mb-6">
          If you believe you were charged, check your payment provider&apos;s receipt
          and contact support@californiamailer.com before attempting another payment.
        </p>
        <Link
          href="/"
          className="block w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-semibold transition-colors"
        >
          Return to Homepage
        </Link>
      </div>
    </main>
  );
}
