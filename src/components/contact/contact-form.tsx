"use client";

import { Loader2, Send } from "lucide-react";
import { useActionState } from "react";
import { createContactInquiry, type ContactState } from "@/actions/contact";

const initial: ContactState = { status: "idle", message: "" };
export function ContactForm({
  labels,
}: {
  labels: {
    name: string;
    email: string;
    company: string;
    location: string;
    message: string;
    send: string;
    note: string;
  };
}) {
  const [state, action, pending] = useActionState(
    createContactInquiry,
    initial,
  );
  const field =
    "h-12 rounded-xl border border-input bg-background px-4 text-base font-normal normal-case tracking-normal text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20";
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {labels.name}
          <input className={field} name="name" required />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {labels.email}
          <input className={field} name="email" type="email" required />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {labels.company}
          <input className={field} name="company" required />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {labels.location}
          <select className={field} name="location">
            <option>Egypt</option>
            <option>Dubai</option>
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {labels.message}
        <textarea
          className={`${field} min-h-36 resize-y py-3`}
          name="message"
          required
          minLength={15}
        />
      </label>
      {state.message && (
        <p
          className={`rounded-xl p-3 text-sm ${state.status === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-gold/10"}`}
        >
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          {labels.note}
        </p>
        <button
          disabled={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {labels.send}
        </button>
      </div>
    </form>
  );
}
