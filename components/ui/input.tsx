import { cn } from "@/lib/utils";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={cn("w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring", props.className)} />; }
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={cn("min-h-32 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring", props.className)} />; }
