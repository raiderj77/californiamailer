import type { Metadata } from 'next';
import { RetiredPrivateLink } from '@/components/public/RetiredPrivateLink';

export const metadata: Metadata = { title: 'Offer unavailable | CaliforniaMailer', robots: { index: false, follow: false } };

export default function OfferPage() {
  return <RetiredPrivateLink title="No verified offer is published" message="The previous public offer route did not have a secure, readable publication model. CaliforniaMailer will not display an advertiser offer until the approved campaign record explicitly publishes it." />;
}
