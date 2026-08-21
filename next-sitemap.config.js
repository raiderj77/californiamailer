const requestTimePublicPaths = [
  '/advertisers',
  '/coop-board',
  '/founding-mailer',
  '/funding-policy',
  '/home',
  '/pricing',
  '/reserve',
  '/sample-card',
];

const publicTransform = async (config, path) => ({
  loc: path,
  changefreq: path === '/coop-board' || path === '/founding-mailer'
    ? 'daily'
    : path === '/mailing-areas'
      ? 'weekly'
      : 'monthly',
  priority: path === '/home'
    ? 1
    : path === '/founding-mailer'
      ? 0.9
      : path === '/mailing-areas'
        ? 0.8
        : 0.7,
  alternateRefs: config.alternateRefs ?? [],
});

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://californiamailer.com',
  generateRobotsTxt: false,
  autoLastmod: false,
  exclude: [
    '/',
    '/api/*',
    '/dashboard',
    '/territories',
    '/prospects',
    '/activities',
    '/campaigns',
    '/calendar',
    '/tasks',
    '/reminders',
    '/invoices',
    '/reports',
    '/templates',
    '/email',
    '/team',
    '/clients',
    '/import',
    '/eddm',
    '/coopspots',
    '/proofs',
    '/offers',
    '/portal',
    '/sales-desk',
    '/launch',
    '/economics',
    '/proof-workflow',
    '/tracking',
    '/crm',
    '/interest-inbox',
    '/refunds',
    '/shared-mailer-calculator',
    '/business-portals',
    '/business-login',
    '/business-login/*',
    '/coupons',
    '/coupon/*',
    '/go/*',
    '/local-deals/unsubscribe',
    '/owner-login',
    '/reservation/*',
    '/approve/*',
    '/track/*',
    '/offer/*',
    '/redeem/*',
    '/payment-success',
    '/payment-cancelled',
    '/current-mailers',
    '/services',
    '/blog/*',
    '/areas/*',
  ],
  // Next 16 omits request-time App Router pages from the generated static
  // manifest. Keep the explicitly public, canonical pages in the sitemap even
  // though their dated price visibility is evaluated per request.
  additionalPaths: async (config) => Promise.all(
    requestTimePublicPaths.map((path) => publicTransform(config, path)),
  ),
  transform: publicTransform,
};
