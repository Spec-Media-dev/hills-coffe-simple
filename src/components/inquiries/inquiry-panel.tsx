"use client";

import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  createProductInquiry,
  createSampleRequestInquiry,
} from "@/actions/inquiries";
import { PublicSampleRequestForm } from "@/components/inquiries/public-inquiry-form";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Link } from "@/i18n/navigation";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionFormState,
} from "@/lib/actions";

type Created = { requestCode: string };

/**
 * Product-inquiry / sample-request entry point on a coffee.
 *
 * The dialog shell is the shared `ModalDialog`, so focus trapping, Escape,
 * focus restoration, scroll lock and the inert background are the ones already
 * proven for the confirmation dialog rather than a second implementation
 * (P7-T05).
 */
export function InquiryPanel({
  offerId,
  coffeeName,
  warehouse,
  signedIn,
  verifiedEmail,
  isCustomer = true,
  activeSampleRequestCode = null,
  labels,
}: {
  offerId: string;
  coffeeName: string;
  warehouse: string;
  signedIn: boolean;
  verifiedEmail: boolean;
  /**
   * Whether this viewer is a customer who could actually create a request —
   * `role = USER`, verified, not blocked. An Administrator and a restricted
   * account both hold a session and a confirmed address, so `signedIn` and
   * `verifiedEmail` are true for them and neither answers this question.
   */
  isCustomer?: boolean;
  /**
   * Set when the server already knows this customer holds an active sample
   * request for this coffee. Presentation only — the refusal itself is still
   * decided by `createSampleRequestInquiry`.
   */
  activeSampleRequestCode?: string | null;
  labels: {
    inquire: string;
    sample: string;
    signin: string;
    message: string;
    send: string;
    title: string;
    body: string;
    sampleTitle: string;
    sampleBody: string;
    sampleSend: string;
    activeSample: string;
    viewRequest: string;
    verify: string;
    close: string;
    publicSampleTitle: string;
    publicSampleBody: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"product" | "sample">("product");

  // Anonymous visitors: the PRODUCT inquiry still requires an account and
  // still routes to sign-in, exactly as before. Only the sample control
  // changed — it now opens a real, working public request instead of being
  // a second link to the sign-in wall (FR-071, FR-079).
  if (!signedIn)
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/sign-in"
            className="inline-flex h-11 min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            {labels.signin}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 min-h-11 items-center justify-center rounded-full border border-primary px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {labels.sample}
          </button>
        </div>

        <ModalDialog
          open={open}
          eyebrow={warehouse}
          title={labels.publicSampleTitle}
          description={`${coffeeName} · ${labels.publicSampleBody}`}
          closeLabel={labels.close}
          onClose={() => setOpen(false)}
        >
          <PublicSampleRequestForm offerId={offerId} />
        </ModalDialog>
      </>
    );

  if (!verifiedEmail)
    return (
      <Link
        href="/verify-email"
        className="inline-flex h-11 min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
      >
        {labels.verify}
      </Link>
    );

  /*
   * Signed in, confirmed, and still not a customer: an Administrator, or a
   * restricted account. Both were previously offered "Commercial inquiry" and
   * "Request sample" because the panel only asked whether a session existed.
   * The submit actions always refused them — `requireVerifiedUser()` rejects
   * ADMIN and blocked — so nothing was ever created, but the buttons implied a
   * capability that does not exist. Offering nothing is the honest state.
   */
  if (!isCustomer) return null;

  const openPanel = (next: "product" | "sample") => {
    setKind(next);
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openPanel("product")}
          className="inline-flex h-11 min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-forest-light"
        >
          {labels.inquire}
        </button>
        {/*
         * An active sample request for this coffee means a second one cannot
         * be created, so offering "Request sample" would invite the customer
         * to write a message only to be refused after sending it. The state
         * and the way out of it are shown instead. The rule is unchanged and
         * still enforced server-side; only the invitation is honest now.
         */}
        {activeSampleRequestCode ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex h-11 min-h-11 items-center justify-center rounded-full border border-border bg-muted px-4 text-xs font-bold text-muted-foreground">
              {labels.activeSample}
            </span>
            <Link
              href={`/account/requests/${activeSampleRequestCode}`}
              className="inline-flex h-11 min-h-11 items-center justify-center rounded-full border border-primary px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {labels.viewRequest}
            </Link>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => openPanel("sample")}
            className="inline-flex h-11 min-h-11 items-center justify-center rounded-full border border-primary px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {labels.sample}
          </button>
        )}
      </div>

      <ModalDialog
        open={open}
        eyebrow={warehouse}
        title={kind === "sample" ? labels.sampleTitle : labels.title}
        description={`${coffeeName} · ${kind === "sample" ? labels.sampleBody : labels.body}`}
        closeLabel={labels.close}
        onClose={() => setOpen(false)}
      >
        <InquiryForm key={kind} kind={kind} offerId={offerId} labels={labels} />
      </ModalDialog>
    </>
  );
}

function InquiryForm({
  kind,
  offerId,
  labels,
}: {
  kind: "product" | "sample";
  offerId: string;
  labels: { message: string; send: string; sampleSend: string };
}) {
  const t = useTranslations("account.responses");
  const requests = useTranslations("account.requests");
  // React resets an uncontrolled field once a form action settles, which would
  // throw away everything the customer typed the moment the server rejected
  // one thing about it. The field therefore holds its own value.
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState(
    kind === "sample" ? createSampleRequestInquiry : createProductInquiry,
    idleActionState as ActionFormState<Created>,
  );

  const outcome = settled(state);
  const errors = fieldErrorsOf(state);
  const copy = (key?: string) => (key ? t(key as Parameters<typeof t>[0]) : "");

  // Both a success and a duplicate carry a request code the customer should be
  // able to open, so the code and its link are rendered from either.
  const requestCode =
    (outcome?.ok ? outcome.data?.requestCode : undefined) ??
    (outcome && !outcome.ok ? outcome.conflict?.requestCode : undefined);

  return (
    <form action={action} noValidate className="mt-7 grid gap-5">
      <input type="hidden" name="offerId" value={offerId} />
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -start-[9999px]"
      />

      <div className="grid gap-2">
        <label
          htmlFor="inquiry-message"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {labels.message}
        </label>
        <textarea
          id="inquiry-message"
          name="message"
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={Boolean(errors?.message?.length) || undefined}
          aria-describedby={
            errors?.message?.length ? "inquiry-message-error" : undefined
          }
          className={`resize-none rounded-xl border bg-background p-4 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-gold/20 ${
            errors?.message?.length
              ? "border-destructive focus:border-destructive"
              : "border-input focus:border-gold"
          }`}
        />
        {errors?.message?.length ? (
          <span
            id="inquiry-message-error"
            className="flex items-start gap-1.5 text-xs font-medium text-destructive"
          >
            <span aria-hidden="true">⚠</span>
            {copy(errors.message[0])}
          </span>
        ) : null}
      </div>

      {/* Missing profile data names the fields and points at the page that
          fixes them, rather than only saying "incomplete". */}
      {errors && (errors.phone || errors.address || errors.country) ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {copy(outcome && !outcome.ok ? outcome.messageKey : undefined)}{" "}
          <Link
            href="/account/settings"
            className="font-bold underline underline-offset-2"
          >
            {requests("completeProfile")}
          </Link>
        </p>
      ) : null}

      {outcome && !outcome.ok && !errors ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {copy(outcome.messageKey)}
          {requestCode ? (
            <>
              {" "}
              <span dir="ltr" className="font-bold">
                {requestCode}
              </span>{" "}
              <Link
                href={`/account/requests/${requestCode}`}
                className="font-bold underline underline-offset-2"
              >
                {requests("viewRequest")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {outcome?.ok ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="me-2 inline size-4" aria-hidden="true" />
          {copy(outcome.messageKey)}
          {requestCode ? (
            <>
              {" "}
              {/* A request code is an identifier, so it stays LTR inside RTL. */}
              <span dir="ltr" className="font-bold">
                {requestCode}
              </span>{" "}
              <Link
                href={`/account/requests/${requestCode}`}
                className="font-bold underline underline-offset-2"
              >
                {requests("viewRequest")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {/* Hidden once it has succeeded: the confirmation and its code stay on
          screen, and the same request cannot be submitted twice by mistake. */}
      {outcome?.ok ? null : (
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="flex h-12 min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          )}
          {kind === "sample" ? labels.sampleSend : labels.send}
        </button>
      )}
    </form>
  );
}
