import type { Metadata } from 'next';
import { RetiredPrivateLink } from '@/components/public/RetiredPrivateLink';

export const metadata: Metadata = { title: 'Checkout unavailable | CaliforniaMailer', robots: { index: false, follow: false } };

export default function PaymentCancelledPage() {
  return <RetiredPrivateLink title="No payment is confirmed" message="Online checkout is not active for the pre-launch campaign. No category or placement is represented as sold from this page." />;
}
