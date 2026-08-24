# Legacy feature retirements

The pre-existing generic CRM could create unsafe, duplicate, or misleading state. The 22 paths below are deleted from the working tree. Route replacements are handled by the current App Router pages and `next.config.ts`; source replacements remain recoverable from Git history. No legacy Firestore document is deleted by these file retirements.

| Deleted path | Replacement or disposition | Why it is retired |
|---|---|---|
| `lib/schemas/faq.ts` | `src/lib/schemas/faq.ts` | Removed the duplicate root-level schema so there is one typed source under `src`. |
| `lib/schemas/organization.ts` | `src/lib/schemas/organization.ts` | Removed the duplicate root-level schema and its split import boundary. |
| `lib/schemas/service.ts` | `src/lib/schemas/service.ts` | Removed the duplicate root-level schema and its split import boundary. |
| `next.config.js` | `next.config.ts` | Consolidated redirects, security headers, and Next.js 16 configuration in one typed config file. |
| `scripts/generate-icons.js` | `scripts/generate-icons.mjs` | Replaced the CommonJS-era script with the ESM script compatible with the package configuration. |
| `src/app/(dashboard)/calendar/page.tsx` | `/dashboard` and CRM next-action dates | Removed a duplicate generic calendar that did not own authoritative campaign or prospect state. |
| `src/app/(dashboard)/campaigns/page.tsx` | `/launch` | Removed manual campaign and sold-state controls that were not tied to the versioned funding/payment ledger. |
| `src/app/(dashboard)/clients/page.tsx` | `/crm`, `/prospects`, and `/business-portals` | Removed generic client records and reusable access assumptions in favor of source-linked CRM records and reservation-scoped access. |
| `src/app/(dashboard)/coopspots/page.tsx` | `/launch` and `/interest-inbox` | Removed manually sold co-op spots; inventory now comes from transactional category/placement records. |
| `src/app/(dashboard)/invoices/page.tsx` | `/economics` and provider-backed payment records | Removed manually selected invoice status as a proxy for cleared revenue. |
| `src/app/(dashboard)/offers/page.tsx` | `/coupons` and `/coupon/[code]` | Removed raw offer codes and mutable public claims; coupons are now paid-reservation-bound, versioned, owner-reviewed, and separately published. |
| `src/app/(dashboard)/portal/page.tsx` | `/business-portals` and `/business-login/[reservationId]` | Removed reusable access codes/name matching in favor of one-time hashed invites and revocable reservation-scoped sessions. |
| `src/app/(dashboard)/pricing/page.tsx` | Public `/pricing`, owner `/economics`, and `/shared-mailer-calculator` | Removed the conflicting generic dashboard price screen; public planning visibility and owner economics now have separate trust boundaries. |
| `src/app/(dashboard)/proofs/page.tsx` | `/proof-workflow` and private reservation proof routes | Removed raw proof URLs and non-versioned decisions in favor of exact latest-version approval with authorization and audit evidence. |
| `src/app/(dashboard)/reminders/page.tsx` | CRM tasks and prospect follow-up fields | Removed a duplicate reminder store that could diverge from the source prospect/opportunity. |
| `src/app/(dashboard)/reports/page.tsx` | `/economics` and `/tracking` | Removed reports based on manual revenue assumptions; financial and response evidence now remain distinct. |
| `src/app/(dashboard)/tasks/page.tsx` | CRM next actions | Removed a generic task collection that was not bound to a prospect, inquiry, interest, or opportunity. |
| `src/app/(dashboard)/team/page.tsx` | One-owner authorization | Removed unsupported multi-user administration from the one-owner launch scope. |
| `src/app/(dashboard)/templates/page.tsx` | `/sales-desk` and the first-party CRM templates add-on | Removed editable send-oriented templates; current templates are copy-only and do not activate outreach. |
| `src/app/(dashboard)/territories/page.tsx` | `/eddm` | Removed uncited browser-authoritative household/income records; current territories use immutable dated route-plan evidence and server totals. |
| `src/app/(public)/areas/[slug]/page.tsx` | `/mailing-areas` and `/territory/monterey-peninsula` | Removed unsupported generated city claims; only the researched Monterey Peninsula page is preserved and unknown legacy paths redirect. |
| `src/components/auth/DashboardAuthProvider.tsx` | Server-verified dashboard layout plus `src/lib/AuthContext.tsx` | Removed the client-only dashboard gate; every owner page now requires the revocation-checked server session before rendering. |

Before any historical record is reused, export and review it, map it explicitly to the current model, and reject legacy manual paid/sold/revenue states, raw access codes, uncited route counts, and mutable proof/offer records as authoritative evidence.
