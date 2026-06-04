import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkPublishableKey } from "@/lib/auth/clerk-build";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantum Reach",
  description: "Enterprise decision-intelligence operating system for CRM, diagnostics, analysis, reporting, and delivery."
};

function ThemeInitializer() {
  const script = `(function(){try{var key='quantumreach-theme';var saved=localStorage.getItem(key);var theme=saved==='dark'||saved==='light'?saved:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.style.colorScheme=theme;}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" suppressHydrationWarning>
      <head><ThemeInitializer /></head>
      <body>{children}</body>
    </html>
  );
  if (!clerkPublishableKey) return body;
  return <ClerkProvider publishableKey={clerkPublishableKey}>{body}</ClerkProvider>;
}
