import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost"; asChild?: boolean; href?: string };
export function Button({ className, variant = "default", asChild, children, ...props }: Props) {
  const classes = cn("inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50", variant === "default" && "bg-primary text-primary-foreground hover:bg-slate-800 dark:hover:bg-slate-200", variant === "outline" && "border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800", variant === "ghost" && "hover:bg-slate-100 dark:hover:bg-slate-800", className);
  if (asChild && React.isValidElement(children)) return React.cloneElement(children as React.ReactElement<{ className?: string }>, { className: cn((children.props as { className?: string }).className, classes) });
  if (props.href) return <Link href={props.href} className={classes}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
