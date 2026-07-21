export function isBillingEnabled() {
  return process.env.BILLING_ENABLED === "true";
}

export function getBillingConfig() {
  const enabled = isBillingEnabled();
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  // Catalog Price mappings are authoritative for Checkout; publishable keys are not needed
  // because this integration redirects to server-created Stripe Checkout Sessions.
  const configured = enabled && hasSecret && hasWebhook;
  return { enabled, configured, hasSecret, hasWebhook };
}

export function requireBillingConfigured() {
  const config = getBillingConfig();
  if (!config.configured) {
    return { ok: false as const, status: 503, message: "Private beta billing is disabled or Stripe is not configured." };
  }
  return { ok: true as const, config };
}
