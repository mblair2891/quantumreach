import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | undefined;

/** Returns the single server-side Stripe client, creating it only when first used. */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.");
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia",
  });

  return stripeClient;
}
