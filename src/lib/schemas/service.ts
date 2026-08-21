import type { Service, WithContext } from 'schema-dts';

export const directMailService: WithContext<Service> = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'CaliforniaMailer founding shared mailer',
  description:
    'A proposed category-exclusive shared-mailer placement with ad layout, online proof approval, a tracking option, and delivery documentation. The campaign is pre-launch and does not promise advertiser results.',
  provider: {
    '@type': 'Organization',
    name: 'CaliforniaMailer',
    url: 'https://californiamailer.com',
  },
  areaServed: {
    '@type': 'Place',
    name: 'Monterey Peninsula, California',
  },
  serviceType: 'Shared direct-mail advertising placement',
};
