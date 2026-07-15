import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | CaliforniaMailer',
  description: 'How CaliforniaMailer handles quote requests, account data, payments, and analytics.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm sm:p-12">
        <Link href="/home" className="text-sm font-medium text-blue-700">← CaliforniaMailer</Link>
        <h1 className="mt-6 text-4xl font-bold text-gray-950">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated July 14, 2026</p>

        <div className="mt-10 space-y-8 leading-7 text-gray-700">
          <section>
            <h2 className="text-xl font-bold text-gray-950">Quote requests</h2>
            <p className="mt-2">
              The quote form collects the name, business name, email address, optional phone number,
              requested service, target area, quantity, and message you choose to provide. CaliforniaMailer
              uses those details to review and respond to the request. Do not submit payment-card numbers,
              account passwords, or other sensitive information in the message field.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-950">Service providers</h2>
            <p className="mt-2">
              Quote emails are delivered through Mailgun. Account and operational records may be stored in
              Firebase for authenticated business workflows. Those providers process data under their own
              terms and privacy notices. CaliforniaMailer does not sell quote-request information.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-950">Payments</h2>
            <p className="mt-2">
              Public online checkout is currently disabled. A verified written quote must precede any
              payment request. If Stripe payment processing is enabled later, this notice and the checkout
              disclosure will be updated before collecting payment information.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-950">Analytics and cookies</h2>
            <p className="mt-2">
              Google Analytics is currently disabled. CaliforniaMailer does not intentionally load optional
              advertising or analytics cookies on the public site. An appropriate notice and consent control
              will be added before optional tracking is enabled where required.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-950">Questions and requests</h2>
            <p className="mt-2">
              To ask about information submitted through the site or request deletion where applicable,
              email hello@californiamailer.com. Some records may need to be retained for security, accounting,
              dispute, or legal obligations.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
