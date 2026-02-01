import { WithContext, Service } from 'schema-dts';

export const directMailService: WithContext<Service> = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Direct Mail Co-op Service",
  "serviceType": "Direct Mail Marketing",
  "provider": {
    "@type": "Organization",
    "name": "CaliforniaMailer",
    "url": "https://californiamailer.com"
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "Monterey",
      "containedIn": {
        "@type": "State",
        "name": "California"
      }
    },
    {
      "@type": "City",
      "name": "Salinas"
    },
    {
      "@type": "City",
      "name": "Carmel-by-the-Sea"
    },
    {
      "@type": "City",
      "name": "Pacific Grove"
    },
    {
      "@type": "City",
      "name": "Seaside"
    },
    {
      "@type": "City",
      "name": "Marina"
    }
  ],
  "description": "Affordable direct mail campaigns for Monterey County businesses through shared mailing costs. Reach thousands of local households at 60-80% lower cost than solo direct mail campaigns.",
  "brand": {
    "@type": "Brand",
    "name": "CaliforniaMailer"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "199.00",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "priceCurrency": "USD",
      "price": "199.00",
      "unitText": "per campaign"
    },
    "availability": "https://schema.org/InStock",
    "url": "https://californiamailer.com/pricing",
    "validFrom": "2024-01-01"
  },
  "termsOfService": "https://californiamailer.com/terms",
  "audience": {
    "@type": "Audience",
    "audienceType": "Small to medium-sized local businesses in Monterey County"
  }
};
