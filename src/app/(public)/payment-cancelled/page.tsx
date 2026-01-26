import Link from 'next/link';

export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your payment was cancelled. No charges have been made to your account.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">Need help?</h3>
            <p className="text-sm text-gray-600">
              If you experienced any issues during checkout or have questions about our services, please do not hesitate to reach out.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/coop-board"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Try Again
            </Link>
            <Link
              href="/home"
              className="block w-full border border-gray-300 hover:border-gray-400 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Questions? Contact us at support@californiamailer.com
        </p>
      </div>
    </div>
  );
}
