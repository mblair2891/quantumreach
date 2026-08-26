import { unsubscribeByToken } from "@/lib/revenue-os/email";

export default async function UnsubscribePage({ params }: { params: { token: string } }) {
  const result = await unsubscribeByToken(params.token);
  const ok = Boolean(result);

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="text-3xl font-semibold text-slate-950">{ok ? "You are unsubscribed" : "Link not valid"}</h1>
      <p className="mt-4 text-slate-700">
        {ok
          ? "Quantum Reach will suppress future outreach to this address. You may still receive transactional messages about an account you created."
          : "This unsubscribe link is invalid or has expired."}
      </p>
    </main>
  );
}
