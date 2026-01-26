'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Confirming your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your payment. We have received your order and will begin processing it right away.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="text-sm text-gray-500 mb-1">Confirmation ID</div>
            <div className="font-mono text-sm text-gray-700 break-all">
              {sessionId || 'Processing...'}
            </div>
          </div>

          <div className="text-left mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>You will receive a confirmation email shortly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Our team will reach out within 1 business day</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Design proofs will be sent for your approval</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              href="/home"
              className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Return to Homepage
            </Link>
            <Link
              href="/quote"
              className="block w-full border border-gray-300 hover:border-gray-400 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
            >
              Start Another Order
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

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
