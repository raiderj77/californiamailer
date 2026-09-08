import Link from "next/link";
export default function PublicSiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="cm-site">
      <a href="#main-content" className="cm-skip">
        Skip to content
      </a>
      <header className="cm-header">
        <Link className="cm-brand" href="/home">
          California<span>Mailer</span>
          <small>LOCAL BUSINESS. LOCAL MAILBOXES.</small>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/coop-board">Co-op postcards</Link>
          <Link href="/services">Services</Link>
          <Link href="/home#how-it-works">How it works</Link>
          <Link className="cm-button" href="/quote">
            Request a quote ↗
          </Link>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="cm-footer">
        <div>
          <Link className="cm-brand" href="/home">
            CaliforniaMailer
          </Link>
          <p>
            Shared postcard advertising for Monterey County and California businesses.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/services">Services</Link>
          <Link href="/quote">Contact & quotes</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Website terms</Link>
        </nav>
        <p className="cm-fine">
          Every Door Direct Mail® and USPS® are trademarks of the United
          States Postal Service. CaliforniaMailer is an independent business and
          is not the Postal Service. © {new Date().getFullYear()}{" "}
          CaliforniaMailer.
        </p>
      </footer>
    </div>
  );
}
