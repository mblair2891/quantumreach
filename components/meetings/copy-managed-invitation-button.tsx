"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyManagedInvitationButton({ meetingId, invitationId, label = "Copy invitation link" }: { meetingId: string; invitationId: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  return <Button type="button" variant="outline" onClick={async () => {
    setStatus("idle");
    const response = await fetch(`/api/meetings/${meetingId}/invitations/${invitationId}/link`, { method: "POST" });
    if (!response.ok) { setStatus("error"); return; }
    const { url } = await response.json() as { url: string };
    await navigator.clipboard.writeText(url);
    setStatus("copied");
    window.setTimeout(() => setStatus("idle"), 2000);
  }}>{status === "copied" ? "Invitation copied" : status === "error" ? "Copy failed" : label}</Button>;
}
