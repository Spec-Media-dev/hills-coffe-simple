"use client";

import { Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { deleteAvatarAction, uploadAvatarAction } from "@/actions/account";
import {
  FormStatus,
  SubmitButton,
  useFormAction,
} from "@/components/forms/form-primitives";

/**
 * Customer profile photo control.
 *
 * The browser-side `accept` and size hint are conveniences only — the server
 * re-reads the bytes, re-measures the size, and verifies the image signature
 * before anything is stored, and the owner-scoped storage policy is the final
 * authority. Nothing here is a security boundary.
 */
export function AvatarForm({
  locale,
  currentUrl,
  initials,
  accept,
  labels,
}: {
  locale: string;
  currentUrl: string | null;
  initials: string;
  accept: string;
  labels: {
    heading: string;
    hint: string;
    choose: string;
    upload: string;
    remove: string;
    current: string;
    none: string;
  };
}) {
  const [uploadState, uploadFormAction, uploading] =
    useFormAction(uploadAvatarAction);
  const [deleteState, deleteFormAction, deleting] =
    useFormAction(deleteAvatarAction);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-5">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-lg font-bold text-gold-bright">
          {currentUrl ? (
            <Image
              src={currentUrl}
              alt={labels.current}
              width={80}
              height={80}
              unoptimized
              className="size-20 object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{labels.heading}</p>
          <p className="mt-1 text-xs text-muted-foreground">{labels.hint}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentUrl ? labels.current : labels.none}
          </p>
        </div>
      </div>

      <form action={uploadFormAction} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-wrap items-center gap-3">
          {/* A visually hidden input keeps the native file picker accessible
              while the visible control matches the design system. */}
          <input
            ref={inputRef}
            id="account-avatar"
            type="file"
            name="avatar"
            accept={accept}
            onChange={(event) =>
              setFileName(event.target.files?.[0]?.name ?? null)
            }
            className="sr-only"
          />
          <label
            htmlFor="account-avatar"
            className="inline-flex h-11 min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:border-gold focus-within:ring-2 focus-within:ring-ring"
          >
            <Upload className="size-4" aria-hidden="true" />
            {labels.choose}
          </label>
          {fileName ? (
            <span className="max-w-[14rem] truncate text-xs text-muted-foreground">
              {fileName}
            </span>
          ) : null}
          <SubmitButton label={labels.upload} pending={uploading} />
        </div>
        <FormStatus state={uploadState} />
      </form>

      {currentUrl ? (
        <form action={deleteFormAction} className="grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <button
              type="submit"
              disabled={deleting}
              aria-busy={deleting}
              className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-destructive/40 bg-card px-5 text-sm font-bold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {labels.remove}
            </button>
          </div>
          <FormStatus state={deleteState} />
        </form>
      ) : null}
    </div>
  );
}
