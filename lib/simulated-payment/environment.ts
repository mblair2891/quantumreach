export type SimulatedPaymentEnvironment = { VERCEL_ENV?: string; NODE_ENV?: string };

export function isSimulatedPaymentEnvironment(env: SimulatedPaymentEnvironment = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false;
  return env.VERCEL_ENV === "preview" || env.NODE_ENV === "development";
}

export function simulatedPaymentEnvironmentName(env: SimulatedPaymentEnvironment = process.env): "preview" | "development" | "unavailable" {
  if (!isSimulatedPaymentEnvironment(env)) return "unavailable";
  return env.VERCEL_ENV === "preview" ? "preview" : "development";
}

export function assertSimulatedPaymentEnvironment(env: SimulatedPaymentEnvironment = process.env): void {
  if (!isSimulatedPaymentEnvironment(env)) throw new Error("Simulated payments are unavailable in this environment.");
}
