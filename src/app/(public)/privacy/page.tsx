import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = {
  title: 'Privacy Policy | CaliforniaMailer',
  description: 'How CaliforniaMailer handles inquiries, campaign records, payments, tracking, and optional email consent.',
  alternates: { canonical: 'https://californiamailer.com/privacy' },
};

export default function PrivacyPage() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-4xl px-5 py-20">
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated August 19, 2026</p>
        <Section title="Information you choose to submit">
          The inquiry form collects a name, business name, email address, optional phone number, contact preference, requested service,
          area, quantity, and message. The reservation-interest and private fulfillment flows may also collect business category, website,
          advertised offer, brand details, ad materials, content, terms acceptances, and proof decisions. Do not submit card numbers,
          account passwords, government identifiers, health information, or other sensitive personal information in a free-text field.
        </Section>
        <Section title="How the information is used">
          CaliforniaMailer uses submitted information to qualify and respond to inquiries, prevent category conflicts,
          administer reservations and payments, create and approve advertising, document delivery, provide campaign reporting,
          manage refunds or disputes, prevent abuse, and maintain required business records.
        </Section>
        <Section title="Service providers">
          Firebase records valid quote inquiries in the private owner CRM for manual review. The current form does not queue or send a quote-request notification email.
          Vercel hosts the application. If activated, Stripe will provide hosted checkout and process payment data under its own notice.
          CaliforniaMailer does not store full card details.
        </Section>
        <Section title="Consumer deals email">
          The optional consumer email list remains inactive unless the owner configures its postal address, sender identity, and activation flag. When active it uses affirmative consent, email verification,
          a stated frequency, an unsubscribe confirmation, and a suppression list. Advertisers buy placement in communications;
          they do not receive the subscriber database. A quote or advertiser inquiry never enrolls a person in consumer marketing.
        </Section>
        <Section title="Tracking and reported outcomes">
          Google Analytics and advertising cookies are currently disabled. Activated campaign redirect links may record a timestamp,
          a limited device/browser description, a privacy-protected network identifier, and the linked advertiser.
          These records measure redirect HTTP requests, not people, scans, customers, or sales; bot and unknown traffic are separated where possible.
          Coupon redemptions, calls, leads, appointments, and sales are advertiser-reported unless a later system explicitly says otherwise.
        </Section>
        <Section title="Private business portal access">
          A business may receive a manually delivered, one-time link for one reservation and placement. CaliforniaMailer stores hashed
          invite and session identifiers rather than the raw secret, and uses an expiring, revocable HttpOnly browser cookie after the
          link is accepted. Portal access is scoped to that reservation; it is not a shared business-wide account. The application does
          not automatically email or text portal links.
        </Section>
        <Section title="Coupon pages and optional AI drafting">
          An owner-published coupon page may show the advertiser&apos;s business name, approved offer, redemption instructions, terms,
          expiration date, and tracked business link. It does not publish consumer identity or prove that a coupon was redeemed. Manual
          coupon drafting works without an AI provider. If the owner separately enables AI drafting, CaliforniaMailer sends only the
          advertiser-supplied business facts and the requested coupon field to OpenAI from the server, requests that the API not store
          the response, and returns an editable draft. AI output is never published automatically and still requires owner review.
        </Section>
        <Section title="Sale or sharing">
          CaliforniaMailer does not sell quote, advertiser, prospect, or subscriber contact information and does not give
          the consumer subscriber list to advertisers. This statement does not describe necessary processing by contracted providers.
        </Section>
        <Section title="Retention and security">
          Records are retained only as needed for the campaign, accounting, consent, suppression, security, dispute,
          or legal purposes. Private notes, payment references, uploads, and contact details are not intended for public campaign records.
          No transmission or storage system can be guaranteed completely secure.
        </Section>
        <Section title="Questions and requests">
          Email hello@californiamailer.com to ask what information you submitted or to request correction or deletion where applicable.
          CaliforniaMailer may need to verify the request and may retain records required for accounting, suppression, disputes, security, or law.
        </Section>
        <p className="mt-12 text-sm leading-6 text-slate-500">
          This notice describes the current application design and is not a legal opinion about whether a particular privacy law applies.
          The owner should obtain California counsel review before production payment or consumer-email activation.
        </p>
      </article>
    </PublicShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-10"><h2 className="text-2xl font-black">{title}</h2><p className="mt-3 leading-8 text-slate-700">{children}</p></section>;
}
