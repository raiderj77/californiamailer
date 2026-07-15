import { WithContext, FAQPage } from 'schema-dts';

export const californiaMailerFAQ: WithContext<FAQPage> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does CaliforniaMailer's co-op direct mail work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "CaliforniaMailer combines multiple Monterey County businesses into a single 9x12 postcard direct mail piece, dramatically reducing costs while maintaining effectiveness. Each business gets dedicated space in professionally designed mailers sent to targeted local households. Costs are shared among 8-16 non-competing advertisers."
      }
    },
    {
      "@type": "Question",
      "name": "What areas does CaliforniaMailer serve?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We serve all of Monterey County, California including Salinas, Monterey, Carmel, Carmel Valley, Pacific Grove, Seaside, Marina, and surrounding communities. Our EDDM service covers specific postal routes throughout the county."
      }
    },
    {
      "@type": "Question",
      "name": "How much does a CaliforniaMailer campaign cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "CaliforniaMailer provides written quotes based on the requested service, quantity, target area, printing, design, preparation, and postage assumptions. USPS currently lists EDDM Retail postage at $0.247 per eligible flat; verify current rates directly with USPS."
      }
    },
    {
      "@type": "Question",
      "name": "What is EDDM and how does it work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Every Door Direct Mail (EDDM) is a USPS service for sending eligible mailpieces across selected postal carrier routes without purchasing a traditional address list. USPS currently lists EDDM Retail postage at $0.247 per eligible flat, and rates can change. Printing, design, preparation, and service costs are separate."
      }
    },
    {
      "@type": "Question",
      "name": "How long does it take to complete a campaign?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "From booking to mailbox delivery typically takes 2-3 weeks. This includes design approval (3-5 days), printing (3-5 days), and USPS delivery (5-10 days). Co-op campaigns run on scheduled mail dates to coordinate multiple advertisers."
      }
    },
    {
      "@type": "Question",
      "name": "Do you provide design services?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, professional design is included in all co-op packages. Our team creates your ad space based on your branding, messaging, and offers. You'll receive a digital proof for approval before printing. For EDDM campaigns, design services are available as an add-on."
      }
    }
  ]
};
