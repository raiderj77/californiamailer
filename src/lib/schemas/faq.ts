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
        "text": "Co-op postcard spots start at $299 per business for campaigns reaching 10,000+ households. EDDM campaigns start at $0.242 per piece with BMEU postage rates. Co-op pricing is typically 60-80% less expensive than solo direct mail campaigns while reaching the same audience."
      }
    },
    {
      "@type": "Question",
      "name": "What is EDDM and how does it work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Every Door Direct Mail (EDDM) is a USPS service that allows you to saturate entire postal carrier routes without needing a mailing list. You simply select the routes you want to target based on demographics and geography, and your mail piece goes to every address on those routes. Rates start at $0.242 per piece."
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
