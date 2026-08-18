import { displayDnsRecordPurpose } from "@/lib/customer-journey/subscriber-copy";
import { displayDnsRecordName } from "@/lib/sending-infrastructure/dns-display";
import { CopyValueButton } from "@/components/dashboard/copy-value-button";

export type DnsTableRecord = {
  id: string;
  type: string;
  name: string;
  value: string;
  purpose: string;
  status: string;
  safeError?: string | null;
};

export function DnsRecordsTable({
  domainName,
  records,
  hostHint,
}: {
  domainName: string;
  records: DnsTableRecord[];
  hostHint?: string | null;
}) {
  return (
    <div>
      <h3 className="font-semibold">Publish these DNS records</h3>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        If your DNS host adds your domain automatically, use the Host name without .{domainName}
      </p>
      {hostHint ? <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{hostHint}</p> : null}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Value</th>
              <th className="py-2 pr-3">What it’s for</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const name = displayDnsRecordName(record.name, domainName);
              return (
                <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 font-mono">{record.type}</td>
                  <td className="py-2 pr-3 align-top">
                    <span className="inline-flex max-w-xs items-start gap-1.5">
                      <span className="min-w-0 break-all font-mono text-xs">{name.host}</span>
                      <CopyValueButton value={name.host} label="Copy" ariaLabel="Copy name" variant="compact" />
                    </span>
                    {name.host !== name.fullName ? (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        Full name: <span className="break-all font-mono">{name.fullName}</span>
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <span className="inline-flex max-w-md items-start gap-1.5">
                      <span className="min-w-0 break-all font-mono text-xs">{record.value}</span>
                      <CopyValueButton value={record.value} label="Copy" ariaLabel="Copy value" variant="compact" />
                    </span>
                  </td>
                  <td className="py-2 pr-3">{displayDnsRecordPurpose(record.purpose)}</td>
                  <td className="py-2">
                    {record.status === "VERIFIED"
                      ? "Found"
                      : record.status === "FAILED"
                        ? record.safeError === "MULTIPLE_SPF_RECORDS"
                          ? "Not matching · Multiple SPF records"
                          : "Not matching"
                        : "Waiting"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
