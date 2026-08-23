import type { Metadata } from 'next';
import { RetiredPrivateLink } from '@/components/public/RetiredPrivateLink';

export const metadata: Metadata = { title: 'Tracking link retired | CaliforniaMailer', robots: { index: false, follow: false } };

export default function TrackPage() {
  return <RetiredPrivateLink title="This raw tracking link has been retired" message="Campaign tracking will reopen only through a private signed link backed by real production and delivery events. No processing or delivery status is inferred here." />;
}
