import { WithContext, Organization } from 'schema-dts';

export const californiaMailerOrg: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "CaliforniaMailer",
  "url": "https://californiamailer.com",
  "logo": "https://californiamailer.com/logo.png",
  "description": "Direct mail automation platform connecting Monterey County businesses with local customers through targeted co-op mailing campaigns and EDDM services",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Monterey County",
    "addressRegion": "CA",
    "addressCountry": "US"
  },
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": "36.6002",
      "longitude": "-121.8947"
    },
    "geoRadius": "50000"
  },
  "email": "hello@californiamailer.com",
  "foundingDate": "2024"
};
