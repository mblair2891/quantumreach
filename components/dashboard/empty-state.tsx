import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, nextAction, href, cta, flow }: { title: string; description: string; nextAction: string; href: string; cta: string; flow: string }) {
  return <Card className="border-dashed border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
      <p><span className="font-medium text-slate-900 dark:text-slate-50">Next:</span> {nextAction}</p>
      <p><span className="font-medium text-slate-900 dark:text-slate-50">Operating flow:</span> {flow}</p>
      <Button asChild><Link href={href}>{cta}</Link></Button>
    </CardContent>
  </Card>;
}

export const emptyStateCopy = {
  leads: {
    title: "No leads yet",
    description: "Leads are the entry point for source tracking, outreach, calls, and opportunity creation.",
    nextAction: "Create or import a lead with a source, permission status, and campaign context.",
    href: "/dashboard/leads",
    cta: "Create lead",
    flow: "Lead/source tracking → outreach campaign → call session."
  },
  outreach: {
    title: "No outreach campaigns yet",
    description: "Outreach campaigns organize assigned leads and make reply, call-booked, and stalled statuses visible.",
    nextAction: "Create a campaign, assign leads, then update each lead's outreach status as work progresses.",
    href: "/dashboard/outreach",
    cta: "Create campaign",
    flow: "Lead/source tracking → outreach campaign/status tracking → call session."
  },
  calls: {
    title: "No calls yet",
    description: "Calls capture discovery conversations and become diagnostics once a transcript is added.",
    nextAction: "Create a call, link CRM context, paste the transcript, then generate a diagnostic.",
    href: "/dashboard/calls/new",
    cta: "Create call",
    flow: "Call session → transcript → diagnostic created from call."
  },
  diagnostics: {
    title: "No diagnostics yet",
    description: "Diagnostics convert call transcripts and CRM context into structured intelligence for analysis.",
    nextAction: "Open a transcript-ready call and create a diagnostic from the transcript.",
    href: "/dashboard/calls",
    cta: "Open calls",
    flow: "Transcript → diagnostic → source-of-truth guided analysis."
  },
  analysis: {
    title: "No analysis records yet",
    description: "Analysis records hold AI-assisted findings that require human review before deliverables are generated.",
    nextAction: "Run analysis from a transcript-ready diagnostic, then review or finalize the result.",
    href: "/dashboard/diagnostics",
    cta: "Open diagnostics",
    flow: "Diagnostic → analysis → human review."
  },
  reports: {
    title: "No reports yet",
    description: "Executive reports are generated from reviewed analysis records using active report frameworks.",
    nextAction: "Review an analysis record and generate an executive report from the analysis detail page.",
    href: "/dashboard/analysis",
    cta: "Open analysis",
    flow: "Human review → executive report."
  },
  roadmaps: {
    title: "No roadmaps yet",
    description: "Roadmaps translate reviewed analysis into phased implementation sequencing.",
    nextAction: "Review an analysis record and generate a roadmap after confirming roadmap framework coverage.",
    href: "/dashboard/analysis",
    cta: "Open analysis",
    flow: "Human review → roadmap → proposal."
  },
  proposals: {
    title: "No proposals yet",
    description: "Proposals package reviewed analysis and roadmap context into a scoped client-facing draft.",
    nextAction: "Generate a proposal from reviewed or final analysis after the proposal framework is active.",
    href: "/dashboard/analysis",
    cta: "Open analysis",
    flow: "Reviewed analysis → report / roadmap / proposal."
  },
  knowledge: {
    title: "No knowledge documents yet",
    description: "Knowledge documents are active source-of-truth materials that guide diagnostics and deliverables.",
    nextAction: "Upload or create approved doctrine and framework documents, then activate only production-ready sources.",
    href: "/dashboard/knowledge/import",
    cta: "Upload documents",
    flow: "Knowledge foundation → guided analysis → traceable deliverables."
  }
} as const;
