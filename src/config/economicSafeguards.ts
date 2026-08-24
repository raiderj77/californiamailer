// These are authorization floors, not editable planning defaults. Every
// customer-price, payment, and production path must enforce at least these
// values. A campaign may deliberately require a higher target or margin.
export const MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS = 250_000;
export const MINIMUM_ECONOMIC_MARGIN_BPS = 2_000;
