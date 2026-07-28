import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { createProgramOrder } from "@/lib/customer-journey/service";
import { trackFunnelEvent } from "@/lib/customer-journey/funnel";
import { readJoinProfile, saveJoinProfile } from "@/lib/customer-journey/profile";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";

async function enroll(formData: FormData) {
  "use server";
  const user = await requireUserProfile();
  await saveJoinProfile(user.id, Object.fromEntries(formData));
  const anonymousId = cookies().get("qr_acquisition")?.value;
  const session = anonymousId ? await prisma.acquisitionSession.findUnique({ where: { anonymousId } }) : null;
  if (session) await prisma.acquisitionSession.update({ where: { id: session.id }, data: { userId: user.id } });
  await trackFunnelEvent("PROGRAM_CHECKOUT_STARTED", { userId: user.id, acquisitionSessionId: session?.id });
  await createProgramOrder(user.id, session?.id);
  redirect("/setup/infrastructure");
}

export default async function JoinPage() {
  let user = null;
  try { user = await requireUserProfile(); } catch {}
  const subscriber = user ? await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } }) : null;
  const saved = readJoinProfile(subscriber?.onboardingProgress);
  return <FunnelShell><main className="mx-auto max-w-3xl px-5 py-12 sm:py-20"><FunnelProgress current={1}/><p className="text-center text-sm font-bold tracking-widest text-indigo-600">FOR QUANTUM REACH SUBSCRIBERS</p><h1 className="mt-3 text-center funnel-title text-4xl font-semibold leading-tight sm:text-5xl">Tell us about your business.</h1><p className="mx-auto mt-5 max-w-2xl funnel-copy text-center">This creates your subscriber profile. Client portal users are invited later and do not use this flow.</p><section className="mt-10 funnel-card p-7 sm:p-9">{user ? <form action={enroll} className="grid gap-5 sm:grid-cols-2"><Field name="firstName" label="First name" value={saved?.firstName ?? user.firstName ?? ""}/><Field name="lastName" label="Last name" value={saved?.lastName ?? user.lastName ?? ""}/><Field name="businessName" label="Business name" value={saved?.businessName}/><Field name="businessType" label="Business type or service" value={saved?.businessType}/><Field name="timezone" label="Timezone" value={saved?.timezone ?? "America/New_York"}/><Field name="country" label="Country code" value={saved?.country ?? "US"} maxLength={2}/><label className="sm:col-span-2">Intended use<textarea className="mt-2 min-h-28 w-full rounded-xl border px-4 py-3" name="intendedUse" required minLength={10} maxLength={1000} defaultValue={saved?.intendedUse}/></label><label className="flex gap-3 text-sm sm:col-span-2"><input type="checkbox" name="agreementAccepted" required defaultChecked={saved?.agreementAccepted === "on"}/><span>I agree to the terms and confirm this information is accurate.</span></label><p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 sm:col-span-2">No payment is claimed here. Preview orders remain pending until an authorized operator applies manual or complimentary clearance.</p><button className="funnel-primary w-full sm:col-span-2">Save profile and choose infrastructure</button></form> : <Link className="flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white" href="/sign-up?redirect_url=/join">Create your subscriber account</Link>}</section></main></FunnelShell>;
}

function Field({ name, label, value, maxLength = 160 }: { name: string; label: string; value?: string | null; maxLength?: number }) {
  return <label>{label}<input className="mt-2 min-h-12 w-full rounded-xl border px-4" name={name} required maxLength={maxLength} defaultValue={value ?? ""}/></label>;
}
