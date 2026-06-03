# Manual Test Checklist

1. Copy `.env.example` to `.env.local` and populate Clerk, Neon, OpenAI, R2, Sentry, and optional Trigger.dev values.
2. Run `npm install`.
3. Run `npm run prisma:generate`.
4. Run `npm run prisma:migrate -- --name init` against a Neon development database.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Verify `/sign-in` and `/sign-up` render Clerk components.
7. Sign up and verify `/onboarding` is protected by Clerk.
8. Create a workspace and verify redirect to `/dashboard`.
9. Use service calls or future forms to create a company, contact, lead, and linked opportunity in the same workspace.
10. Confirm workspace-scoped service helpers reject access from users without workspace membership.
11. Create a diagnostic session with transcript text.
12. Run an analyzer with a valid OpenAI key and confirm AnalyzerRun, AIExecution, and AIOutputArtifact records persist.
13. Create ROI, report, roadmap, proposal, project, milestone, and project task records.
14. Review AI execution logs and audit logs.
15. Run `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before deployment.
16. For production rate limiting, replace the in-memory limiter with a shared store-backed limiter such as Upstash Redis or Vercel KV before public traffic.
