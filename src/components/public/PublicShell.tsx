import { Breadcrumbs } from './Breadcrumbs';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <SiteHeader />
      <main><Breadcrumbs />{children}</main>
      <SiteFooter />
    </div>
  );
}
