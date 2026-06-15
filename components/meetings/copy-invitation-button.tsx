"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyInvitationButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <Button
    type="button"
    variant="outline"
    onClick={async () => {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }}
  >
    {copied ? "Copied" : "Copy invitation"}
  </Button>;
}
