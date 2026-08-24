import type { Organization, WithContext } from 'schema-dts';

export const californiaMailerOrg: WithContext<Organization> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CaliforniaMailer',
  url: 'https://californiamailer.com',
  description:
    'An owner-managed shared-mailer service preparing one pre-funded Monterey Peninsula founding campaign.',
  areaServed: {
    '@type': 'Place',
    name: 'Monterey Peninsula, California',
  },
};
