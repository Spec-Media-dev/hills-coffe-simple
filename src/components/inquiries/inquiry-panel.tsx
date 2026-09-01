"use client";

import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  createProductInquiry,
  createSampleRequestInquiry,
} from "@/actions/inquiries";
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
  labels,
}: {
  offerId: string;
  coffeeName: string;
  warehouse: string;
  signedIn: boolean;
  verifiedEmail: boolean;
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
    verify: string;
    close: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"product" | "sample">("product");

  if (!signedIn)
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          href="/sign-in"
          className="inline-flex h-11 min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
        >
          {labels.signin}
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-11 min-h-11 items-center justify-center rounded-full border border-primary px-4 text-xs font-bold text-primary"
        >
          {labels.sample}
        </Link>
      </div>
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
        <button
          type="button"
          onClick={() => openPanel("sample")}
          className="inline-flex h-11 min-h-11 items-center justify-center rounded-full border border-primary px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {labels.sample}
        </button>
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
