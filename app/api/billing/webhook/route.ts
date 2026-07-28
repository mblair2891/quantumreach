// Temporary compatibility alias. Keep /api/webhooks/stripe as the only endpoint
// registered in Stripe; both paths share verification and ledger processing.
export { POST } from "@/app/api/webhooks/stripe/route";
