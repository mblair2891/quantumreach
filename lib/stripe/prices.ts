/** Server-only mapping from stable catalog keys to Stripe Price environment variables. */
const priceEnvironmentKeys = {
  QUANTUM_REACH_CORE: "STRIPE_PRICE_QUANTUM_REACH_CORE",
  LAUNCH_SENDER_PACKAGE: "STRIPE_PRICE_LAUNCH_SENDER_PACKAGE",
  GROWTH_SENDER_PACKAGE: "STRIPE_PRICE_GROWTH_SENDER_PACKAGE",
  SCALE_SENDER_PACKAGE: "STRIPE_PRICE_SCALE_SENDER_PACKAGE",
  STANDARD_SETUP: "STRIPE_PRICE_STANDARD_SETUP",
  PRIORITY_SETUP: "STRIPE_PRICE_PRIORITY_SETUP",
  AGENCY_WHITE_LABEL_UPGRADE: "STRIPE_PRICE_AGENCY_WHITE_LABEL_UPGRADE",
  ADDITIONAL_DOMAIN_PACK: "STRIPE_PRICE_ADDITIONAL_DOMAIN_PACK",
  ADDITIONAL_SENDER_PACK: "STRIPE_PRICE_ADDITIONAL_SENDER_PACK",
  ADDITIONAL_SEND_CAPACITY: "STRIPE_PRICE_ADDITIONAL_SEND_CAPACITY",
} as const;

export type StripeCommerceProductCode = keyof typeof priceEnvironmentKeys;

export function resolveStripePrice(code: string): string {
  const environmentKey = priceEnvironmentKeys[code as StripeCommerceProductCode];
  if (!environmentKey) throw new Error(`Unsupported commerce product code: ${code}.`);
  const price = process.env[environmentKey]?.trim();
  if (!price) throw new Error(`Stripe price mapping is required for ${code} (${environmentKey}).`);
  return price;
}
