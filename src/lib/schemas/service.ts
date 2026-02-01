import { WithContext, Service } from 'schema-dts';

export const directMailService: WithContext<Service> = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Direct Mail Co-op & EDDM Service",
  "serviceType": "Direct Mail Marketing",
  "provider": {
    "@type": "Organization",
    "name": "CaliforniaMailer"
  },
  "areaServed": {
    "@type": "State",
    "name": "California",
    "containsPlace": {
      "@type": "City",
      "name": "Monterey County"
    }
  },
  "description": "Affordable direct mail campaigns for Monterey County businesses through shared co-op mailing costs and Every Door Direct Mail (EDDM) services. Reach 10,000+ households per campaign.",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "299",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "priceCurrency": "USD",
      "price": "299",
      "unitText": "per co-op spot"
    }
  }
};
