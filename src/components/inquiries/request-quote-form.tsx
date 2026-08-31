"use client";
import { useActionState } from "react";
import { createProductInquiry, type InquiryState } from "@/actions/inquiries";

const initial: InquiryState = { status: "idle", message: "" };
export function RequestQuoteForm({
  locale,
  offers,
}: {
  locale: "en" | "ar";
  offers: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    createProductInquiry,
    initial,
  );
  const text =
    locale === "ar"
      ? {
          offer: "العرض",
          subject: "موضوع الطلب",
          message: "تفاصيل الطلب",
          send: "إرسال الطلب",
          choose: "اختر عرضاً",
        }
      : {
          offer: "Offer",
          subject: "Request subject",
          message: "Request details",
          send: "Send request",
          choose: "Choose an offer",
        };
  return (
    <form
      action={action}
      className="grid gap-5 rounded-[1.5rem] border border-border bg-card p-7"
    >
      <input type="hidden" name="locale" value={locale} />
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -start-[9999px]"
      />
      <label className="grid gap-2 text-sm font-bold">
        {text.offer}
        <select
          name="offerId"
          required
          className="h-12 rounded-xl border border-input bg-background px-4 font-normal"
        >
          <option value="">{text.choose}</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold">
        {text.subject}
        <input
          name="subject"
          maxLength={160}
          className="h-12 rounded-xl border border-input bg-background px-4 font-normal"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        {text.message}
        <textarea
          name="message"
          minLength={10}
          maxLength={2000}
          required
          rows={6}
          className="rounded-xl border border-input bg-background p-4 font-normal"
        />
      </label>
      {state.message ? (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${state.status === "success" ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}
        >
          {state.message}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60"
      >
        {text.send}
      </button>
    </form>
  );
}
