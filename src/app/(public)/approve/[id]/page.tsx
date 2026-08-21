import type { Metadata } from 'next';
import { RetiredPrivateLink } from '@/components/public/RetiredPrivateLink';

export const metadata: Metadata = { title: 'Proof link retired | CaliforniaMailer', robots: { index: false, follow: false } };

export default function ApprovePage() {
  return <RetiredPrivateLink title="This raw proof link has been retired" message="Proofs will reopen only with a signed, expiring access token, a versioned private asset, and a stored approver decision. A document ID alone is not sufficient authorization." />;
}
