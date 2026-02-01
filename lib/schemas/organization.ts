import { WithContext, Organization } from 'schema-dts';

export const californiaMailerOrg: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "CaliforniaMailer",
  "url": "https://californiamailer.com",
  "logo": "https://californiamailer.com/logo.png",
  "description": "Direct mail co-op service connecting Monterey County businesses with local customers through targeted mailing campaigns. Founded by Jason Ramirez, a 30+ year veteran in web marketing and lead generation.",
  "foundingDate": "2024",
  "founder": {
    "@type": "Person",
    "name": "Jason Ramirez",
    "jobTitle": "Founder & CEO",
    "knowsAbout": ["Direct Mail Marketing", "Lead Generation", "Local Marketing", "Web Development"]
  },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Monterey",
    "addressRegion": "CA",
    "postalCode": "93940",
    "addressCountry": "US"
  },
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": "36.6002",
      "longitude": "-121.8947"
    },
    "geoRadius": "50000" // 50km radius covers all Monterey County
  },
  "email": "hello@californiamailer.com",
  "sameAs": [
    // Add these as you create them
    // "https://www.linkedin.com/company/californiamailer",
    // "https://twitter.com/californiamailer",
    // "https://www.facebook.com/californiamailer"
  ]
};
