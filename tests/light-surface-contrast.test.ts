import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("light-surface text contrast", () => {
  it("keeps funnel/auth surfaces out of the global dark variant", () => {
    const tailwind = source("tailwind.config.ts");
    const css = source("app/globals.css");
    expect(tailwind).toContain("funnel-page");
    expect(tailwind).toContain("qr-light-surface");
    expect(tailwind).toContain("&:is(.dark *)");
    expect(css).toContain(".funnel-page");
    expect(css).toContain(".qr-light-surface");
    expect(css).toContain("color: #0f172a");
    expect(css).toContain(".funnel-status-value");
    expect(css).toContain("text-slate-900");
    expect(css).toContain(".funnel-status-label");
  });

  it("gives setup status labels and values explicit high-contrast colors", () => {
    const page = source("app/setup/status/page.tsx");
    expect(page).toContain("funnel-status-label");
    expect(page).toContain("funnel-status-value");
    expect(page).toContain("text-slate-950");
    expect(page).not.toContain("dark:text-indigo-100");
    expect(page).not.toContain("dark:bg-indigo-950");
  });

  it("keeps confirmation setup cards on light semantic colors", () => {
    const page = source("app/setup/confirmation/page.tsx");
    expect(page).toContain("text-emerald-950");
    expect(page).toContain("text-indigo-950");
    expect(page).not.toContain("dark:text-emerald-100");
    expect(page).not.toContain("dark:text-indigo-100");
    expect(page).not.toContain("dark:bg-emerald-950");
  });

  it("does not strip dashboard dark-shell pairing", () => {
    const shell = source("components/dashboard/shell.tsx");
    expect(shell).toContain("dark:bg-slate-950");
    expect(shell).toContain("dark:text-slate-50");
    expect(shell).toContain("dark:text-slate-300");
  });
});
