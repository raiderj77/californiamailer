import type { FAQPage, WithContext } from 'schema-dts';

export const californiaMailerFAQ: WithContext<FAQPage> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the founding campaign accepting payment now?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. The default campaign is pre-launch and checkout remains disabled until campaign economics, policies, routes, identity, and payment configuration are reviewed.',
      },
    },
    {
      '@type': 'Question',
      name: 'What counts toward the funding goal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Only cleared payment, net of recorded refunds. Interest, unpaid holds, pending, failed, cancelled, refunded, and disputed amounts are not treated as cleared funding.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does CaliforniaMailer guarantee advertising results?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. CaliforniaMailer does not promise calls, leads, appointments, sales, profit, or return on investment.',
      },
    },
  ],
};
