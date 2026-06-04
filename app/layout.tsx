import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkPublishableKey } from "@/lib/auth/clerk-build";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantum Reach",
  description: "Enterprise decision-intelligence operating system for CRM, diagnostics, analysis, reporting, and delivery."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  if (!clerkPublishableKey) return body;
  return <ClerkProvider publishableKey={clerkPublishableKey}>{body}</ClerkProvider>;
}
