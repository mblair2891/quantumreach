import { BarChart3, Briefcase, ClipboardList, CreditCard, FileText, Globe2, Handshake, Home, Kanban, Mail, Settings, ShieldCheck, Users, Video, Wallet, Zap, type LucideIcon } from "lucide-react";
export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavSection = { heading: string; items: NavItem[] };
export const workspaceNavigation: NavSection[] = [
 { heading: "HOME", items: [{ label: "Dashboard", href: "/dashboard", icon: Home }] },
 { heading: "SALES", items: ["CRM","Contacts","Companies","Opportunities","Pipeline","Tasks"].map((l)=>({label:l,href:`/dashboard/${l.toLowerCase().replace(/ /g,"-")}`,icon:l==="Companies"?Briefcase:l==="Pipeline"?Kanban:l==="Tasks"?ClipboardList:Users})) },
 { heading: "OUTREACH", items: [{label:"Imports",href:"/dashboard/imports",icon:Users},{label:"Campaigns",href:"/dashboard/campaigns",icon:Mail},{label:"Email Sequences",href:"/dashboard/email-sequences",icon:Mail},{label:"Sending Domains",href:"/dashboard/sending/domains",icon:Globe2},{label:"Mailboxes",href:"/dashboard/sending/mailboxes",icon:Mail},{label:"Sender Identities",href:"/dashboard/sending/senders",icon:Mail},{label:"Deliverability",href:"/dashboard/sending/deliverability",icon:BarChart3}] },
 { heading: "MEETINGS", items: [{label:"Scheduling",href:"/dashboard/scheduling",icon:Video},{label:"Meetings",href:"/dashboard/meetings",icon:Video},{label:"Calls",href:"/dashboard/calls",icon:Video},{label:"Research",href:"/dashboard/research",icon:Zap},{label:"Interview Questions",href:"/dashboard/interview-questions",icon:ClipboardList}] },
 { heading: "DELIVERY", items: ["Analysis","Proposals","Contracts","Onboarding","Projects","Deliverables","Reports","Roadmaps"].map((l)=>({label:l,href:`/dashboard/${l.toLowerCase()}`,icon:l==="Roadmaps"?Kanban:l==="Projects"||l==="Onboarding"?ClipboardList:FileText})) },
 { heading: "KNOWLEDGE", items: [{label:"Knowledge Base",href:"/dashboard/knowledge",icon:FileText},{label:"AI Activity",href:"/dashboard/ai-executions",icon:Zap}] },
 { heading: "WORKSPACE", items: [{label:"Team",href:"/dashboard/team",icon:Users},{label:"Integrations",href:"/dashboard/settings/integrations/meetings",icon:Settings},{label:"Billing",href:"/dashboard/billing",icon:CreditCard},{label:"Partner Center",href:"/dashboard/partner",icon:Handshake},{label:"Settings",href:"/dashboard/settings",icon:Settings}] },
];
export const platformNavigation: NavSection[] = [
 { heading: "OVERVIEW", items: [{label:"Platform Dashboard",href:"/platform",icon:Home}]},
 { heading: "CUSTOMERS", items: [{label:"Subscribers",href:"/platform/subscribers",icon:Users},{label:"Workspaces",href:"/platform/workspaces",icon:Briefcase}]},
 { heading: "COMMERCE", items: [{label:"Subscriptions",href:"/platform/subscriptions",icon:CreditCard},{label:"Billing Operations",href:"/platform/billing",icon:CreditCard},{label:"Plans",href:"/platform/plans",icon:ClipboardList},{label:"Revenue",href:"/platform/revenue",icon:BarChart3}]},
 { heading: "PARTNERS", items: [{label:"Affiliates",href:"/platform/affiliates",icon:Handshake},{label:"Affiliate settings",href:"/platform/affiliates/settings",icon:Settings},{label:"Commissions",href:"/platform/commissions",icon:Wallet},{label:"Payouts",href:"/platform/payouts",icon:CreditCard}]},
 { heading: "OPERATIONS", items: [{label:"Provisioning",href:"/platform/provisioning",icon:ClipboardList},{label:"Infrastructure Jobs",href:"/platform/infrastructure-jobs",icon:ClipboardList},{label:"Managed Domains",href:"/platform/domains",icon:Globe2},{label:"Email Infrastructure",href:"/platform/email",icon:Mail},{label:"Providers",href:"/platform/providers",icon:Zap},{label:"Support",href:"/platform/support",icon:ShieldCheck}]},
 { heading: "SYSTEM", items: [{label:"Audit",href:"/platform/audit",icon:FileText},{label:"Platform Settings",href:"/platform/settings",icon:Settings}]},
];
export const clientPortalNavigation: NavSection[] = [
 { heading: "HOME", items: [{label:"Overview",href:"/portal",icon:Home}]},
 { heading: "WORK", items: [{label:"Projects",href:"/portal/projects",icon:Briefcase},{label:"Roadmaps",href:"/portal/roadmaps",icon:Kanban},{label:"Deliverables",href:"/portal/deliverables",icon:FileText},{label:"Tasks",href:"/portal/tasks",icon:ClipboardList}]},
 { heading: "MEETINGS", items: [{label:"Upcoming Meetings",href:"/portal/meetings",icon:Video},{label:"Meeting Summaries",href:"/portal/summaries",icon:FileText}]},
 { heading: "DOCUMENTS", items: [{label:"Reports",href:"/portal/reports",icon:FileText},{label:"Proposals",href:"/portal/proposals",icon:FileText},{label:"Contracts",href:"/portal/contracts",icon:FileText}]},
 { heading: "ONBOARDING", items: [{label:"Onboarding Plan",href:"/portal/onboarding",icon:ClipboardList},{label:"Required Actions",href:"/portal/actions",icon:ClipboardList}]},
 { heading: "ACCOUNT", items: [{label:"Client Profile",href:"/portal/profile",icon:Users},{label:"Shared Documents",href:"/portal/documents",icon:FileText}]},
];
