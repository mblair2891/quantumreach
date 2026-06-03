export type JobName = "run-analyzer" | "generate-report" | "sync-audit";
export async function enqueueJob(name: JobName, payload: Record<string, unknown>) {
  // Trigger.dev client configuration is intentionally deferred until project id/secret are configured in deployment.
  return { provider: "trigger.dev", status: "queued-locally", name, payload };
}
