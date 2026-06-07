"use client";

import { Button } from "@/components/ui/button";

type KnowledgeDeleteActionProps = {
  action: () => Promise<void>;
  disabled?: boolean;
};

export function KnowledgeDeleteAction({ action, disabled }: KnowledgeDeleteActionProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete permanently? This cannot be undone. Generated chunks for this document will also be deleted.")) {
          event.preventDefault();
        }
      }}
      className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-950 dark:bg-red-950/30"
    >
      <p className="text-sm font-semibold text-red-900 dark:text-red-100">Danger zone</p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-200">Permanent deletion cannot be undone. Active documents and documents already used as sources must be archived instead.</p>
      <Button type="submit" variant="outline" disabled={disabled} className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950">
        Delete permanently
      </Button>
    </form>
  );
}
