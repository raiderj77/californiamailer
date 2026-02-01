/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://californiamailer.com',
  generateRobotsTxt: false, // We have a custom robots.txt
  exclude: [
    '/api/*',
    '/admin/*', 
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
    '/pricing', // Internal pricing calculator
    '/import',
    '/eddm', // Internal EDDM lookup
    '/coopspots', // Internal co-op management
    '/proofs', // Internal proof approval
    '/offers', // Internal offers management
    '/portal', // Client portal with access codes
  ],
  
  // Priority pages for SEO
  additionalPaths: async (config) => {
    const result = [];

    // Homepage - highest priority
    result.push({
      loc: '/home',
      changefreq: 'weekly',
      priority: 1.0,
      lastmod: new Date().toISOString(),
    });

    // Core service pages
    result.push({
      loc: '/services',
      changefreq: 'monthly',
      priority: 0.9,
      lastmod: new Date().toISOString(),
    });

    result.push({
      loc: '/coop-board',
      changefreq: 'daily', // Updates frequently with new spots
      priority: 0.9,
      lastmod: new Date().toISOString(),
    });

    result.push({
      loc: '/quote',
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    });

    // City/Area pages
    const cities = [
      'salinas',
      'monterey',
      'carmel',
      'carmel-valley',
      'pacific-grove',
      'seaside',
      'marina',
    ];

    cities.forEach(city => {
      result.push({
        loc: `/areas/${city}`,
        changefreq: 'monthly',
        priority: 0.8,
        lastmod: new Date().toISOString(),
      });
    });

    // Special AI discoverability file
    result.push({
      loc: '/llms.txt',
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    });

    return result;
  },

  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    additionalSitemaps: [
      'https://californiamailer.com/sitemap.xml',
    ],
  },
};
