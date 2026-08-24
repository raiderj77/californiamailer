import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="text-lg font-black text-white">CaliforniaMailer</div>
          <p className="mt-3 max-w-md text-sm leading-6">
            Owner-managed California direct-mail and partner-placement planning: one Monterey Peninsula founding shared mailer plus
            quote-only single-business postcards and documented partner-distributed placements. No campaign result or advertiser response is promised.
          </p>
          <p className="mt-3 text-sm">Public reply mailbox pending identity and delivery verification. Use the contact page for the current inquiry boundary.</p>
        </div>
        <div>
          <div className="font-bold text-white">Campaign</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/founding-mailer" className="hover:text-white">Founding mailer</Link></li>
            <li><Link href="/mailing-areas" className="hover:text-white">Mailing areas</Link></li>
            <li><Link href="/pricing" className="hover:text-white">Proposed pricing</Link></li>
            <li><Link href="/california-postcard-mailing" className="hover:text-white">California postcard mailing</Link></li>
            <li><Link href="/pizza-box-advertising" className="hover:text-white">Pizza box advertising</Link></li>
            <li><Link href="/funding-policy" className="hover:text-white">Funding and refunds</Link></li>
            <li><Link href="/advertiser-content-standards" className="hover:text-white">Content standards</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold text-white">Company</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/local-deals" className="hover:text-white">Local deals email</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">Owner sign-in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 px-5 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} CaliforniaMailer. Owner-managed. All rights reserved.
      </div>
    </footer>
  );
}
