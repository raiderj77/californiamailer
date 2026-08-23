export interface SuppressibleRecord {
  status?: unknown;
  doNotContact?: unknown;
  suppressed?: unknown;
}

export function isRecordSuppressed(record: SuppressibleRecord) {
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : '';
  return record.doNotContact === true
    || record.suppressed === true
    || status === 'do_not_contact'
    || status === 'suppressed';
}

// There is intentionally no inverse helper. Reopening a suppressed record
// requires a separate, explicit, audited renewed-consent workflow that this
// release does not provide.
export function enforceStickySuppression<T extends SuppressibleRecord>(record: T): T {
  if (!isRecordSuppressed(record)) return record;
  return {
    ...record,
    status: 'do_not_contact',
    doNotContact: true,
    suppressed: true,
  } as T;
}
