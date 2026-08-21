import type { Metadata } from 'next';
import { RetiredPrivateLink } from '@/components/public/RetiredPrivateLink';

export const metadata: Metadata = { title: 'Payment verification unavailable | CaliforniaMailer', robots: { index: false, follow: false } };

export default function PaymentSuccessPage() {
  return <RetiredPrivateLink title="Payment is not verified on this page" message="Online checkout is currently disabled. A URL parameter is not evidence of payment, a sold category, or campaign funding. Future payment results must be verified server-side against the private reservation and provider record." />;
}
