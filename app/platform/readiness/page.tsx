import { getProviderReadiness } from "@/lib/sending-infrastructure/providers";
export default function PlatformReadinessPage() { const readiness = getProviderReadiness(); return <main><h1>Infrastructure Launch Readiness</h1><pre>{JSON.stringify(readiness, null, 2)}</pre></main>; }
