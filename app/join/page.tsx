import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { finalizeAcquisitionOrder } from "@/lib/customer-journey/service";
import { loadValidatedDraft, money, summarizeDraft } from "@/lib/customer-journey/acquisition-draft";
import { readJoinProfile, saveJoinProfile } from "@/lib/customer-journey/profile";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";

async function submitOrder(formData: FormData) {
  "use server";
  const user = await requireUserProfile();
  const resume = String(formData.get("resume") ?? "");
  await saveJoinProfile(user.id, Object.fromEntries(formData));
  const selection = await loadValidatedDraft(resume);
  if (selection.session.userId && selection.session.userId !== user.id) throw new Error("This package selection belongs to another account.");
  await finalizeAcquisitionOrder(user.id, resume);
  cookies().set("qr_acquisition", resume, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  redirect("/setup/confirmation?submitted=1");
}

export default async function JoinPage({ searchParams }: { searchParams: { resume?: string } }) {
  const user = await requireUserProfile();
  const resume = searchParams.resume ?? cookies().get("qr_acquisition")?.value;
  if (!resume) redirect("/start");
  let selection; try { selection = await loadValidatedDraft(resume); } catch { redirect("/start?selection=expired"); }
  if (selection.session.userId && selection.session.userId !== user.id) redirect("/start?selection=owned");
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
  const saved = readJoinProfile(subscriber?.onboardingProgress); const totals = summarizeDraft(selection);
  return <FunnelShell><main className="mx-auto max-w-4xl px-5 py-12 sm:py-16"><FunnelProgress current={5}/><p className="text-center funnel-eyebrow">Step 5 · Account and business profile</p><h1 className="mt-3 text-center funnel-title text-4xl font-semibold">Create your {selection.core.name} workspace.</h1><p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">Your account is ready. Complete the business profile used to create your isolated subscriber workspace, then submit the unpaid order.</p><div className="mt-8 grid gap-3 rounded-2xl border bg-slate-50 p-5 sm:grid-cols-2"><Summary label="Software" value={selection.core.name}/><Summary label="Infrastructure" value={selection.infrastructure.name}/><Summary label="Setup" value={selection.setup.name}/><Summary label="Expected recurring" value={allConfigured(totals) ? money(totals.recurringCents) : "Confirmed before clearance"}/><Summary label="Expected one-time" value={allConfigured(totals) ? money(totals.oneTimeCents) : "Confirmed before clearance"}/><Link className="text-sm font-semibold text-indigo-700 underline" href="/setup/confirmation">Review or edit selections</Link></div><form action={submitOrder} className="mt-8 grid gap-5 rounded-2xl border bg-white p-7 sm:grid-cols-2"><input type="hidden" name="resume" value={resume}/><Field name="firstName" label="First name" value={saved?.firstName ?? user.firstName}/><Field name="lastName" label="Last name" value={saved?.lastName ?? user.lastName}/><Field name="businessName" label="Business name" value={saved?.businessName}/><Field name="businessType" label="Business type or service" value={saved?.businessType}/><Field name="timezone" label="Timezone" value={saved?.timezone ?? "America/New_York"}/><Field name="country" label="Country code" value={saved?.country ?? "US"} maxLength={2}/><label className="sm:col-span-2">Intended use<textarea className="mt-2 min-h-28 w-full rounded-xl border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" name="intendedUse" required minLength={10} maxLength={1000} defaultValue={saved?.intendedUse}/></label><label className="flex gap-3 text-sm sm:col-span-2"><input type="checkbox" name="agreementAccepted" required defaultChecked={saved?.agreementAccepted === "on"}/><span>I agree to the terms and confirm the order and business information are accurate.</span></label><p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">Submitting creates an unpaid order awaiting authorized operator clearance. It does not claim payment or provider provisioning.</p><button className="funnel-primary w-full disabled:opacity-60 sm:col-span-2">Submit unpaid order</button></form></main></FunnelShell>;
}

function allConfigured(totals: ReturnType<typeof summarizeDraft>) { return totals.core.configured && totals.infrastructure.configured && totals.setup.configured; }
function Summary({ label, value }: { label: string; value: string }) { return <div><span className="text-sm text-slate-500">{label}</span><p className="font-semibold">{value}</p></div>; }
function Field({ name, label, value, maxLength = 160 }: { name: string; label: string; value?: string | null; maxLength?: number }) { return <label>{label}<input className="mt-2 min-h-12 w-full rounded-xl border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" name={name} required maxLength={maxLength} defaultValue={value ?? ""}/></label>; }
