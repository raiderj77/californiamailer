export function safeTrackingDestination(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (isNonPublicIpLiteral(host)) return null;
    return url.toString();
  } catch { return null; }
}

function isNonPublicIpLiteral(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized.includes(':')) {
    if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isNonPublicIpv4(mapped) : false;
  }
  return /^\d+\.\d+\.\d+\.\d+$/.test(normalized) ? isNonPublicIpv4(normalized) : false;
}

function isNonPublicIpv4(host: string): boolean {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 192 && b === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

export const selfReportedMetricTypes = ['coupon_redemption', 'lead', 'call', 'appointment', 'sale', 'note'] as const;

export type SelfReportedMetricType = (typeof selfReportedMetricTypes)[number];

export function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function summarizeRedirectRequests(
  events: Array<{ eventType?: unknown; suspectedBot?: unknown }>,
) {
  const redirects = events.filter((event) => event.eventType === 'redirect_visit');
  return {
    nonBotHttpRequests: redirects.filter((event) => event.suspectedBot === false).length,
    suspectedBotHttpRequests: redirects.filter((event) => event.suspectedBot === true).length,
    unknownClassificationHttpRequests: redirects.filter(
      (event) => typeof event.suspectedBot !== 'boolean',
    ).length,
  };
}

export function summarizeSelfReportedMetrics(
  reports: Array<{ metricType?: unknown; quantity?: unknown }>,
): Record<SelfReportedMetricType, number> {
  const totals = Object.fromEntries(
    selfReportedMetricTypes.map((metricType) => [metricType, 0]),
  ) as Record<SelfReportedMetricType, number>;

  for (const report of reports) {
    if (!selfReportedMetricTypes.includes(report.metricType as SelfReportedMetricType)) continue;
    const quantity = Number(report.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    totals[report.metricType as SelfReportedMetricType] += quantity;
  }
  return totals;
}
