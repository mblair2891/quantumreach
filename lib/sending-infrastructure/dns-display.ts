/** Zone-relative DNS host for registrar UIs that append the domain automatically. */

export function normalizeDnsName(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function zoneRelativeHost(name: string, zone: string) {
  const host = normalizeDnsName(name);
  const apex = normalizeDnsName(zone);
  if (!host || !apex) return name;
  if (host === apex) return "@";
  const suffix = `.${apex}`;
  if (host.endsWith(suffix)) return host.slice(0, -suffix.length);
  return name;
}

export function displayDnsRecordName(name: string, zone: string) {
  const fullName = normalizeDnsName(name) || name;
  const host = zoneRelativeHost(name, zone);
  return { host, fullName };
}

export function nameserverProviderHint(nameservers: string[]) {
  const joined = nameservers.map((item) => item.toLowerCase()).join(" ");
  if (joined.includes("cloudflare")) {
    return "Nameservers look like Cloudflare. Cloudflare adds your domain automatically — paste the Host name, not the full name.";
  }
  if (joined.includes("vercel-dns") || joined.includes("vercel.")) {
    return "Nameservers look like Vercel. Vercel adds your domain automatically — paste the Host name, not the full name.";
  }
  if (joined.includes("domaincontrol")) {
    return "Nameservers look like GoDaddy. GoDaddy adds your domain automatically — paste the Host name, not the full name.";
  }
  if (joined.includes("registrar-servers")) {
    return "Nameservers look like Namecheap. Namecheap adds your domain automatically — paste the Host name, not the full name.";
  }
  if (joined.includes("awsdns")) {
    return "Nameservers look like Amazon Route 53. If the hosted zone already includes your domain, paste the Host name, not the full name.";
  }
  return null;
}
