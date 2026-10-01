"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, X } from "lucide-react";
import { BrandMark } from "@/components/brand/mark";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { useConsent } from "./consent-provider";

export function CookieSettingsButton() {
  const t = useTranslations("privacy");
  const { reopen } = useConsent();
  return (
    <button
      type="button"
      onClick={reopen}
      className="min-h-11 w-fit text-start underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
    >
      {t("settings")}
    </button>
  );
}

export function CookieConsentDialog() {
  const t = useTranslations("privacy");
  const brand = useTranslations("brand");
  const { consent, ready, requested, save } = useConsent();
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const handledRequest = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const show = () => {
      if (!consent || requested > handledRequest.current) {
        setAnalytics(consent?.analytics ?? false);
        setManaging(requested > 0);
        setOpen(true);
        handledRequest.current = requested;
      }
    };
    if (document.querySelector('[data-home-loading="true"]')) {
      window.addEventListener("hills:home-ready", show, { once: true });
      return () => window.removeEventListener("hills:home-ready", show);
    }
    show();
  }, [ready, requested, consent]);

  function decide(value: boolean) {
    save(value);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl sm:max-w-[46rem] sm:p-8"
      >
        <div className="flex shrink-0 items-center justify-between gap-6 border-b border-border pb-4">
          <BrandMark height={36} label={brand("logoAlt")} />
          <DialogClose
            aria-label={t("close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <X size={18} />
          </DialogClose>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <div>
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <DialogTitle className="font-heading text-2xl leading-tight sm:text-3xl">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="mt-4 text-base leading-relaxed text-muted-foreground">
              {t("description")}
            </DialogDescription>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("noAdvertising")}{" "}
              <Link
                href="/legal"
                className="underline underline-offset-4 focus-visible:outline-2"
              >
                {t("policy")}
              </Link>
            </p>
          </div>
          {managing && (
            <div className="mt-5 grid gap-3">
              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t("necessary")}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t("necessaryDescription")}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {t("alwaysOn")}
                </span>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{t("analytics")}</span>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t("analyticsDescription")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  className="mt-1 size-6 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                />
              </label>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => decide(false)}
            className="btn-secondary min-h-11 flex-1"
          >
            {t("reject")}
          </button>
          {managing ? (
            <button
              type="button"
              onClick={() => decide(analytics)}
              className="btn-secondary min-h-11 flex-1"
            >
              {t("save")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setManaging(true)}
              className="btn-secondary min-h-11 flex-1"
            >
              {t("manage")}
            </button>
          )}
          <button
            type="button"
            onClick={() => decide(true)}
            className="btn-primary min-h-11 flex-1"
          >
            {t("accept")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
