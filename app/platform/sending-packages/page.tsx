import { DEFAULT_COMMERCE_CATALOG } from "@/lib/sending-infrastructure/catalog";
export default function PlatformSendingPackagesPage() { const pkgs = DEFAULT_COMMERCE_CATALOG.filter((p) => p.category === "SENDING_PACKAGE"); return <main><h1>Sending Packages</h1>{pkgs.map((p) => <section key={p.key}><h2>{p.name}</h2><pre>{JSON.stringify(p.entitlements, null, 2)}</pre></section>)}</main>; }
