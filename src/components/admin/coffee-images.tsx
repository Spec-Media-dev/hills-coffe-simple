"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  attachCoffeeImagesAction,
  removeCoffeeImageAction,
  reorderCoffeeImagesAction,
  setMainCoffeeImageAction,
} from "@/actions/admin-catalog";
import {
  AdminField,
  AdminFileField,
  AdminForm,
} from "@/components/admin/admin-form";
import type { AdminCoffeeImage } from "@/lib/data/admin-catalog";

/**
 * Coffee image management on the existing normalized model:
 * `coffees → coffee_media → media → Storage`.
 *
 * No column is added to `coffees`. Exactly one row per coffee carries
 * `role = 'MAIN'` — enforced by the partial unique index
 * `coffee_media_one_main_image` — and the rest are `GALLERY`, ordered by
 * `sort_order`. Promotion demotes the previous main first, because the index
 * would otherwise reject two mains.
 */
export function CoffeeImages({
  coffeeId,
  images,
}: {
  coffeeId: string;
  images: AdminCoffeeImage[];
}) {
  const t = useTranslations("admin.catalog");
  const responses = useTranslations("admin.responses");
  const [order, setOrder] = useState(images);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  const gallery = order.filter((image) => image.role === "GALLERY");
  const main = order.find((image) => image.role === "MAIN");

  async function run(
    action: (
      state: unknown,
      data: FormData,
    ) => Promise<{ ok: boolean; messageKey?: string }>,
    data: FormData,
  ) {
    setBusy(true);
    try {
      const result = await action(undefined, data);
      const message = result.messageKey
        ? responses(result.messageKey as Parameters<typeof responses>[0])
        : "";
      if (result.ok) toast.success(message);
      else toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const send = (extra: Record<string, string | string[]>) => {
    const data = new FormData();
    data.set("coffeeId", coffeeId);
    for (const [key, value] of Object.entries(extra)) {
      if (Array.isArray(value))
        value.forEach((entry) => data.append(key, entry));
      else data.set(key, value);
    }
    return data;
  };

  function move(mediaId: string, delta: number) {
    const index = gallery.findIndex((image) => image.mediaId === mediaId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder([...(main ? [main] : []), ...next]);
    void run(
      reorderCoffeeImagesAction as never,
      send({ order: next.map((image) => image.mediaId) }),
    );
  }

  return (
    <section className="mt-6 grid gap-5 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl">{t("images")}</h2>

      {order.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("noImagesYet")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...(main ? [main] : []), ...gallery].map((image) => (
            <li
              key={image.mediaId}
              className="overflow-hidden rounded-xl border border-border"
            >
              <div className="relative aspect-4/3 bg-muted">
                <Image
                  src={image.url}
                  alt={image.altEn || image.altAr || ""}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
                <span
                  className={`absolute top-2 start-2 rounded-full px-2.5 py-1 text-xs font-bold ${
                    image.role === "MAIN"
                      ? "bg-gold text-forest-deep"
                      : "bg-background/90"
                  }`}
                >
                  {image.role === "MAIN" ? t("mainImage") : t("galleryImage")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {image.role === "GALLERY" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          setMainCoffeeImageAction as never,
                          send({ mediaId: image.mediaId }),
                        )
                      }
                      className="inline-flex h-11 min-h-11 items-center rounded-full border border-border px-4 text-xs font-bold disabled:opacity-60"
                    >
                      {t("makeMain")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${t("moveUp")} — ${image.altEn || image.mediaId}`}
                      onClick={() => move(image.mediaId, -1)}
                      className="inline-flex size-11 min-h-11 items-center justify-center rounded-full border border-border text-xs font-bold disabled:opacity-60"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${t("moveDown")} — ${image.altEn || image.mediaId}`}
                      onClick={() => move(image.mediaId, 1)}
                      className="inline-flex size-11 min-h-11 items-center justify-center rounded-full border border-border text-xs font-bold disabled:opacity-60"
                    >
                      ↓
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOrder((current) =>
                      current.filter(
                        (entry) => entry.mediaId !== image.mediaId,
                      ),
                    );
                    void run(
                      removeCoffeeImageAction as never,
                      send({ mediaId: image.mediaId }),
                    );
                  }}
                  className="inline-flex h-11 min-h-11 items-center rounded-full border border-destructive px-4 text-xs font-bold text-destructive disabled:opacity-60"
                >
                  {t("removeImage")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminForm
        action={attachCoffeeImagesAction}
        submitLabel={t("upload")}
        pendingLabel={t("uploading")}
        className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-2"
      >
        <input type="hidden" name="coffeeId" value={coffeeId} />
        <div className="md:col-span-2">
          <AdminFileField
            name="images"
            label={t("imageFiles")}
            hint={t("imageFilesHint")}
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={(files) =>
              setPreviews(files.map((file) => URL.createObjectURL(file)))
            }
          />
        </div>
        {previews.length ? (
          <ul className="flex flex-wrap gap-2 md:col-span-2">
            {previews.map((src) => (
              <li
                key={src}
                className="size-20 overflow-hidden rounded-lg border border-border"
              >
                {/* Local object URL preview before anything is uploaded. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-20 object-cover" />
              </li>
            ))}
          </ul>
        ) : null}
        <AdminField name="altEn" label={t("altEn")} dir="ltr" />
        <AdminField name="altAr" label={t("altAr")} dir="rtl" />
      </AdminForm>
    </section>
  );
}
