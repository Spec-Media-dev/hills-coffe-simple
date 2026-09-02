"use client";

import { ImageOff, Search, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { uploadMediaAction } from "@/actions/admin-media";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { idleActionState } from "@/lib/actions";

/**
 * The one media picker (P8-T03).
 *
 * Coffee, origin, article, CMS section and site logo all select from the same
 * library through this component. Five separate selection widgets would mean
 * five places for the archived-item rule, the alt-text warning and the
 * keyboard behaviour to drift apart.
 *
 * It contributes a plain hidden input, so the surrounding `<form>` submits a
 * media id like any other field and the server keeps validating it.
 *
 * Uploading happens by calling the server action directly rather than by
 * nesting a second `<form>` — nested forms are invalid HTML and the browser
 * silently drops the inner one, which would make the upload button do nothing.
 */

export type PickerItem = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  altEn: string | null;
  altAr: string | null;
  storagePath: string;
};

export function MediaPicker({
  name,
  items,
  defaultValue = null,
  required = false,
  invalid = false,
  describedBy,
  onSelect,
}: {
  name: string;
  items: PickerItem[];
  defaultValue?: string | null;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /**
   * Notified when the selection changes. The hidden input remains the way a
   * surrounding `<form>` reads the value; this is for the one consumer that
   * attaches through its own action rather than a form submit (origin media).
   */
  onSelect?: (mediaId: string | null) => void;
}) {
  const t = useTranslations("admin.media");
  // Server-issued failures resolve against the Admin response catalogue, the
  // same one every other Admin form uses.
  const responses = useTranslations("admin.responses");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedIdState] = useState<string | null>(
    defaultValue,
  );
  const setSelectedId = (next: string | null) => {
    setSelectedIdState(next);
    onSelect?.(next);
  };
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState(items);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => library.find((item) => item.id === selectedId) ?? null,
    [library, selectedId],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return library;
    return library.filter((item) =>
      [item.altEn, item.altAr, item.storagePath]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(term)),
    );
  }, [library, query]);

  async function upload(formData: FormData) {
    setUploadError(null);
    const file = formData.get("pickerFile");
    if (!(file instanceof File) || file.size === 0) {
      setUploadError("imageRequired");
      return;
    }
    const payload = new FormData();
    payload.set("file", file);
    payload.set("altEn", String(formData.get("pickerAltEn") ?? ""));
    payload.set("altAr", String(formData.get("pickerAltAr") ?? ""));
    const result = await uploadMediaAction(idleActionState, payload);
    if (!result.ok) {
      // The action returns a message key; the field error is the specific one.
      const fieldKey =
        result.fieldErrors?.file?.[0] ?? result.fieldErrors?.altEn?.[0];
      setUploadError(fieldKey ?? result.messageKey);
      return;
    }
    const mediaId = result.data?.mediaId;
    if (!mediaId) return;
    // Show it immediately and select it, rather than asking the Admin to
    // reopen the picker to find what they just uploaded.
    const objectUrl = URL.createObjectURL(file);
    setLibrary((current) => [
      {
        id: mediaId,
        url: objectUrl,
        width: null,
        height: null,
        altEn: String(payload.get("altEn") ?? ""),
        altAr: String(payload.get("altAr") ?? "") || null,
        storagePath: "",
      },
      ...current,
    ]);
    setSelectedId(mediaId);
    setOpen(false);
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={selectedId ?? ""} />

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted ${
            invalid ? "border-destructive" : "border-border"
          }`}
        >
          {selected ? (
            /* Library thumbnails include freshly uploaded blob: URLs, which
               the image optimizer cannot process. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.url}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageOff
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="grid gap-1">
          <p className="text-sm">
            {selected ? (
              selected.altEn || t("untitled")
            ) : (
              <span className="text-muted-foreground">{t("noneSelected")}</span>
            )}
          </p>
          {/* A missing Arabic alt text is stated, never invented. */}
          {selected && !selected.altAr ? (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {t("missingArabicAlt")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-describedby={describedBy}
              className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-bold transition hover:border-gold"
            >
              {selected ? t("changeMedia") : t("chooseMedia")}
            </button>
            {selected && !required ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-bold transition hover:border-destructive"
              >
                <X className="size-3.5" aria-hidden="true" />
                {t("clearMedia")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ModalDialog
        open={open}
        title={t("pickerTitle")}
        description={t("pickerBody")}
        closeLabel={t("close")}
        onClose={() => setOpen(false)}
      >
        <div className="mt-6 grid gap-5">
          <label className="grid gap-1.5 text-sm font-bold">
            {t("searchLabel")}
            <span className="relative">
              <Search
                className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchHint")}
                className="h-11 w-full rounded-lg border border-input bg-background ps-10 pe-3 font-normal"
              />
            </span>
          </label>

          {filtered.length ? (
            <ul className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {filtered.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setOpen(false);
                      }}
                      aria-pressed={isSelected}
                      className={`grid w-full gap-2 rounded-xl border p-2 text-start transition ${
                        isSelected
                          ? "border-gold ring-2 ring-gold/30"
                          : "border-border hover:border-gold"
                      }`}
                    >
                      <span className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </span>
                      <span className="block truncate text-xs">
                        {item.altEn || t("untitled")}
                      </span>
                      {!item.altAr ? (
                        <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          {t("missingArabicAltShort")}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {library.length ? t("noMatches") : t("emptyLibrary")}
            </p>
          )}

          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-bold">
              <span className="inline-flex items-center gap-2">
                <Upload className="size-4" aria-hidden="true" />
                {t("uploadNew")}
              </span>
            </summary>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm font-bold">
                {t("file")}
                <input
                  type="file"
                  name="pickerFile"
                  accept="image/jpeg,image/png,image/webp"
                  className="rounded-lg border border-input bg-background p-2 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold">
                {t("altEn")}
                <input
                  name="pickerAltEn"
                  dir="ltr"
                  className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold">
                {t("altAr")}
                <input
                  name="pickerAltAr"
                  dir="rtl"
                  className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
                />
              </label>
              {uploadError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive"
                >
                  {responses(uploadError as Parameters<typeof responses>[0])}
                </p>
              ) : null}
              <button
                type="button"
                disabled={pending}
                aria-busy={pending}
                onClick={(event) => {
                  // Collect the sibling inputs by name: they are deliberately
                  // not a nested form.
                  const root = event.currentTarget.closest("details");
                  if (!root) return;
                  const data = new FormData();
                  for (const field of root.querySelectorAll<HTMLInputElement>(
                    "input[name]",
                  ))
                    data.set(
                      field.name,
                      field.type === "file"
                        ? (field.files?.[0] ?? "")
                        : field.value,
                    );
                  startTransition(() => {
                    void upload(data);
                  });
                }}
                className="h-11 min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {t("uploadAndSelect")}
              </button>
            </div>
          </details>
        </div>
      </ModalDialog>
    </div>
  );
}
