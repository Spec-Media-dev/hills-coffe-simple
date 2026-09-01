"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { deletePriceTierAction } from "@/actions/admin-catalog";
import { idleActionState } from "@/lib/actions";

/** Deletes one price tier and reports the outcome in the active locale. */
export function DeleteTierButton({ id, label }: { id: string; label: string }) {
  const responses = useTranslations("admin.responses");
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const data = new FormData();
          data.set("id", id);
          const result = await deletePriceTierAction(idleActionState, data);
          const message = result.messageKey
            ? responses(result.messageKey as Parameters<typeof responses>[0])
            : "";
          if (result.ok) toast.success(message);
          else toast.error(message);
        } finally {
          setPending(false);
        }
      }}
      className="inline-flex h-11 min-h-11 items-center rounded-full border border-destructive px-4 text-xs font-bold text-destructive disabled:opacity-60"
    >
      {label}
    </button>
  );
}
