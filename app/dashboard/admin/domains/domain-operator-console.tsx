"use client";

import { useFormState } from "react-dom";
import { requestDomainQuote, searchDomainAvailability, submitHorizonTestRegistration } from "./actions";

type ProviderError = { code?: string; message: string; testMode?: boolean; validationReasons?: string[] };
type DomainActionResult = { ok?: boolean; safeError?: string; providerError?: ProviderError; data?: { domainName?: string; providerDomainId?: string; available?: boolean; estimatedCostCents?: number } | Array<{ domainName?: string; providerDomainId?: string; available?: boolean; estimatedCostCents?: number }> } | null;
const initial = null;
type DomainFormAction = (state: DomainActionResult, payload: FormData) => Promise<DomainActionResult>;
function Result({ result }: { result: DomainActionResult }) {
  if (!result) return null;
  const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  return <div className="mt-3 rounded-lg border bg-white p-3 text-sm"><p className="font-semibold">OpenSRS Horizon TEST result</p>{result.safeError ? <p className="text-red-700">{result.safeError}</p> : null}{result.providerError ? <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-800"><p className="font-semibold">Provider TEST diagnostic</p>{result.providerError.code ? <p>Provider code: {result.providerError.code}</p> : null}<p>Provider message: {result.providerError.message}</p>{result.providerError.testMode ? <p className="font-semibold">Mode: TEST</p> : null}{result.providerError.validationReasons?.length ? <ul className="list-disc pl-5">{result.providerError.validationReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}</div> : null}{rows.map((row) => <p key={row.domainName || row.providerDomainId}>{row.domainName || row.providerDomainId}: {row.available === false ? "unavailable" : "available/test accepted"}{row.estimatedCostCents ? ` · quote $${(row.estimatedCostCents / 100).toFixed(2)}` : ""}</p>)}</div>;
}
export function DomainOperatorConsole() {
  const [search, searchAction] = useFormState(searchDomainAvailability as DomainFormAction, initial as DomainActionResult);
  const [quote, quoteAction] = useFormState(requestDomainQuote as DomainFormAction, initial as DomainActionResult);
  const [purchase, purchaseAction] = useFormState(submitHorizonTestRegistration as DomainFormAction, initial as DomainActionResult);
  return <section className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-950"><h2 className="text-lg font-semibold">OpenSRS Horizon TEST console</h2><p>No production purchasing, billing, DNS, or SES mutation is performed. Use only test domains and operator-only Horizon actions.</p><div className="grid gap-4 md:grid-cols-3"><form action={searchAction} className="mt-3 space-y-2"><label className="block font-medium">Search availability</label><input className="w-full rounded border p-2" name="domain" placeholder="example-test.com" required /><button className="rounded bg-blue-700 px-3 py-2 text-white">Search TEST</button><Result result={search} /></form><form action={quoteAction} className="mt-3 space-y-2"><label className="block font-medium">Request quote</label><input className="w-full rounded border p-2" name="domain" placeholder="example-test.com" required /><button className="rounded bg-blue-700 px-3 py-2 text-white">Quote TEST</button><Result result={quote} /></form><form action={purchaseAction} className="mt-3 space-y-2"><label className="block font-medium">Submit Horizon test registration</label><input className="w-full rounded border p-2" name="domain" placeholder="example-test.com" required /><button className="rounded bg-amber-700 px-3 py-2 text-white">Create TEST purchase request</button><Result result={purchase} /></form></div></section>;
}
