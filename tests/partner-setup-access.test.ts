import { describe, expect, it } from "vitest";
import { SetupProgressCard } from "@/components/dashboard/setup-progress-card";

describe("partner and setup security source boundaries", () => {
 it("keeps setup progress data-driven without a percentage", () => { expect(SetupProgressCard.toString()).not.toContain("%"); });
 it("documents server-side partner and white-label access guards", async () => { const source = await import("node:fs/promises").then(fs => fs.readFile("lib/saas/partner-access.ts", "utf8")); expect(source).toContain("AFFILIATE_ENABLED"); expect(source).toContain("WHITE_LABEL_ENABLED"); expect(source).toContain("getWorkspaceEffectiveEntitlements"); });
});
