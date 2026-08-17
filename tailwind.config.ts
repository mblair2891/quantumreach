import type { Config } from "tailwindcss";

const config: Config = {
  // Dark utilities apply under .dark, but never inside always-light funnel/auth surfaces.
  darkMode: ["variant", "&:is(.dark *):not(.funnel-page *):not(.qr-light-surface *)"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" }
      },
      borderRadius: { xl: "1rem", lg: "0.75rem", md: "0.5rem" }
    }
  },
  plugins: []
};
export default config;
