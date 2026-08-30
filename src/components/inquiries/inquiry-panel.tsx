"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { createProductInquiry, type InquiryState } from "@/actions/inquiries";
import { Link } from "@/i18n/navigation";

const initialState: InquiryState = { status: "idle", message: "" };

export function InquiryPanel({
  offerId,
  coffeeName,
  warehouse,
  signedIn,
  labels,
}: {
  offerId: string;
  coffeeName: string;
  warehouse: string;
  signedIn: boolean;
  labels: {
    inquire: string;
    signin: string;
    quantity: string;
    message: string;
    send: string;
    title: string;
    body: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createProductInquiry,
    initialState,
  );
  useEffect(() => {
    if (state.status === "success") {
      const timer = setTimeout(() => setOpen(false), 2200);
      return () => clearTimeout(timer);
    }
  }, [state]);
  if (!signedIn)
    return (
      <Link
        href="/sign-in"
        className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
      >
        {labels.signin}
      </Link>
    );
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-forest-light"
      >
        {labels.inquire}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-end bg-black/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`inquiry-${offerId}`}
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="eyebrow">{warehouse}</p>
                  <h2 id={`inquiry-${offerId}`} className="mt-3 text-3xl">
                    {labels.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {coffeeName} · {labels.body}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-border"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <form action={action} className="mt-7 grid gap-5">
                <input type="hidden" name="offerId" value={offerId} />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {labels.quantity}
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    name="quantity"
                    required
                    defaultValue="10"
                    className="h-12 rounded-xl border border-input bg-background px-4 text-base text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {labels.message}
                  <textarea
                    name="message"
                    required
                    minLength={10}
                    rows={5}
                    placeholder="Target profile, timing, sample needs…"
                    className="resize-none rounded-xl border border-input bg-background p-4 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>
                {state.message && (
                  <p
                    className={`rounded-xl p-3 text-sm ${state.status === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-gold/10 text-foreground"}`}
                  >
                    {state.status === "success" && (
                      <CheckCircle2 className="me-2 inline size-4" />
                    )}
                    {state.message}
                  </p>
                )}
                <button
                  disabled={pending}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  )}
                  {labels.send}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
