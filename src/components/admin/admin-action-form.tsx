"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  idleAdminActionState,
  type AdminActionState,
} from "@/lib/admin/action-state";

type AdminServerAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export function AdminActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className,
  danger = false,
  encType,
  dir,
}: {
  action: AdminServerAction;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  danger?: boolean;
  encType?: "multipart/form-data";
  dir?: "rtl" | "ltr";
}) {
  const [state, formAction, pending] = useActionState(
    action,
    idleAdminActionState,
  );
  const announced = useRef("");

  useEffect(() => {
    if (
      !state.message ||
      announced.current === `${state.status}:${state.message}`
    )
      return;
    announced.current = `${state.status}:${state.message}`;
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className={className}
      encType={encType}
      dir={dir}
    >
      {children}
      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{state.message}</p>
          {state.fieldErrors ? (
            <ul className="mt-1 list-inside list-disc text-xs">
              {Object.entries(state.fieldErrors).flatMap(([field, messages]) =>
                messages.map((message) => (
                  <li key={`${field}-${message}`}>
                    {field}: {message}
                  </li>
                )),
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={
          danger
            ? "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-destructive px-4 text-sm font-bold text-destructive disabled:opacity-60"
            : "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
