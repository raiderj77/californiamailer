import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Local coupon | CaliforniaMailer',
  robots: { index: false, follow: false },
};

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/coupon/${encodeURIComponent(code)}`);
}
