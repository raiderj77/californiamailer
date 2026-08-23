# Reservation-scoped business portals

CaliforniaMailer has passwordless private access for one reservation and one business placement at a time. It does not create a shared business-wide account.

## Owner workflow

1. Open **Business portals** in the owner dashboard.
2. Select a real reservation.
3. Choose a 1-hour, 24-hour, 72-hour, or 7-day invite lifetime.
4. Type `CREATE ONE-TIME PORTAL LINK` and create the link.
5. Copy the link from the one response that contains it and deliver it manually to the reservation contact.

The application does not email, text, or otherwise send the link. Creating another link invalidates earlier unconsumed portal links for that reservation.

Production link creation requires `NEXT_PUBLIC_SITE_URL` to be set to the canonical HTTPS origin. The origin is validated before the database creates an invite.

## Security model

- Invite and session tokens are generated from 32 random bytes.
- Firestore document IDs contain only SHA-256 token hashes; raw tokens are not stored in Firestore, logs, or audit records by application code.
- A one-time invite is checked and consumed in the same Firestore transaction that creates its session.
- The manually copied link puts the raw invite token in a URL fragment. Browsers do not send fragments in HTTP requests. The access page removes the fragment from the address bar before posting the token for consumption, then redirects to a token-free URL.
- The consume route sets the existing `cm_reservation_{reservationId}` cookie with `HttpOnly`, `SameSite=Lax`, a root path, an expiry, and `Secure` in production.
- Sessions expire after 30 days. Every protected reservation read uses `verifyReservationAccess`, which re-reads the session and reservation and checks the exact reservation ID, active status, expiry, and current access version.
- Newly issued legacy reservation cookies have a matching server-side access version, explicit active status, and 90-day server expiry. Every legacy read checks all three in addition to the token hash; older records without that metadata and copied tokens from an expired or revoked version fail closed. **Revoke all** increments the reservation access version, marks legacy access revoked, and clears the token hash, immediately invalidating legacy access and every prior portal session.
- Logout revokes the current database session when it is a new portal session and always expires the browser cookie.
- Firestore browser reads and writes are explicitly denied for `advertiserportalinvites` and `advertiserportalsessions`.

## Intentional limits

- No reusable password, password reset, business-wide user account, team membership, or cross-reservation access exists.
- No automated delivery or outbound provider is activated.
- A manually copied URL is a bearer credential until it is used, expires, is superseded, or is revoked. The owner must share it only with the intended reservation contact.
- The access page requires JavaScript so it can remove the fragment before the token is submitted.
- Expired and revoked invite/session documents remain inert but are not automatically deleted; configure a separate Firestore retention policy if record cleanup is later required.
