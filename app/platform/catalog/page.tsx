import { DEFAULT_COMMERCE_CATALOG, pricingLabel } from "@/lib/sending-infrastructure/catalog";
export default function PlatformCatalogPage() { return <main><h1>Commerce Product Catalog</h1><ul>{DEFAULT_COMMERCE_CATALOG.map((p) => <li key={p.key}>{p.name} — {p.category} — {pricingLabel(p)}</li>)}</ul></main>; }
