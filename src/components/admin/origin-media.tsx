"use client";

import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  attachOriginMediaAction,
  removeOriginMediaAction,
  reorderOriginMediaAction,
  setOriginHeroAction,
} from "@/actions/admin-origin-media";
import { MediaPicker, type PickerItem } from "@/components/admin/media-picker";
import { idleActionState, type ActionResult } from "@/lib/actions";
import type { OriginImage } from "@/lib/data/origin-media";

/**
 * Origin image management on the existing `origins → origin_media → media`
 * relation (finding N61).
 *
 * Nothing here uploads. Images are chosen from the shared library through the
 * same `MediaPicker` that serves coffees, articles, CMS sections and the site
 * logo — and the picker's own upload control still routes through the one
 * secure pipeline, so a brand-new image can be brought in without leaving this
 * screen.
 *
 * Exactly one hero is a database guarantee
 * (`origin_media_one_hero_image`); this component only presents it.
 */
export function OriginMedia({
  originId,
  images,
  library,
}: {
  originId: string;
  images: OriginImage[];
  library: PickerItem[];
}) {
  const t = useTranslations("admin.originMedia");
  const responses = useTranslations("admin.responses");
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState(images);
  const [pending, startTransition] = useTransition();

  const hero = order.find((image) => image.role === "HERO") ?? null;
  const gallery = order.filter((image) => image.role === "GALLERY");

  function run(
    action: (
      state: typeof idleActionState,
      data: FormData,
    ) => Promise<ActionResult>,
    data: FormData,
  ) {
    startTransition(async () => {
      const result = await action(idleActionState, data);
      const key =
        (!result.ok && Object.values(result.fieldErrors ?? {})[0]?.[0]) ||
        result.messageKey;
      const message = key
        ? responses(key as Parameters<typeof responses>[0])
        : "";
      // Errors are the server's message key, resolved in the active locale —
      // never provider text.
      if (result.ok) toast.success(message);
      else toast.error(message);
    });
  }

  const attach = (role: "HERO" | "GALLERY") => {
    if (!selected) {
      toast.error(responses("mediaRequired"));
      return;
    }
    const data = new FormData();
    data.set("originId", originId);
    data.set("mediaId", selected);
    data.set("role", role);
    run(attachOriginMediaAction, data);
  };

  const move = (index: number, delta: number) => {
    const next = [...gallery];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder([...(hero ? [hero] : []), ...next]);
  };

  const saveOrder = () => {
    const data = new FormData();
    data.set("originId", originId);
    for (const image of gallery) data.append("order", image.mediaId);
    run(reorderOriginMediaAction, data);
  };

  const single = (
    action: (
      state: typeof idleActionState,
      data: FormData,
    ) => Promise<ActionResult>,
    mediaId: string,
  ) => {
    const data = new FormData();
    data.set("originId", originId);
    data.set("mediaId", mediaId);
    run(action, data);
  };

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-2xl">{t("title")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {t("intro")}
      </p>

      {!order.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : null}

      {/* ------------------------------------------------------------ hero */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-muted-foreground">{t("hero")}</h3>
        {hero ? (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">
            <Thumb image={hero} untitled={t("untitled")} />
            <div className="grid gap-1">
              <strong className="text-sm">{hero.altEn || t("untitled")}</strong>
              {hero.archived ? (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {t("archived")}
                </span>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => single(removeOriginMediaAction, hero.mediaId)}
                className="mt-1 inline-flex h-11 min-h-11 items-center gap-2 self-start rounded-full border border-border px-4 text-xs font-bold transition hover:border-destructive hover:text-destructive disabled:opacity-60"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t("remove")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("noHero")}</p>
        )}
      </div>

      {/* --------------------------------------------------------- gallery */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-muted-foreground">
          {t("gallery")}
        </h3>
        {gallery.length ? (
          <>
            <ul className="mt-3 grid gap-3">
              {gallery.map((image, index) => (
                <li
                  key={image.mediaId}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4"
                >
                  <Thumb image={image} untitled={t("untitled")} />
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {image.altEn || t("untitled")}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {t("position", { index: index + 1 })}
                    </span>
                    {image.archived ? (
                      <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-400">
                        {t("archived")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <IconButton
                      label={t("moveUp")}
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t("moveDown")}
                      disabled={pending || index === gallery.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t("makeHero")}
                      disabled={pending}
                      onClick={() => single(setOriginHeroAction, image.mediaId)}
                    >
                      <Star className="size-3.5" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t("remove")}
                      disabled={pending}
                      destructive
                      onClick={() =>
                        single(removeOriginMediaAction, image.mediaId)
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={pending}
              onClick={saveOrder}
              className="mt-4 h-11 min-h-11 rounded-full border border-border px-5 text-sm font-bold transition hover:border-gold disabled:opacity-60"
            >
              {t("saveOrder")}
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("noGallery")}</p>
        )}
      </div>

      {/* ----------------------------------------------------------- add */}
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="text-sm font-bold">{t("chooseImage")}</h3>
        <div className="mt-3 grid gap-4">
          {/* The shared picker. Its own upload control routes through the one
              secure pipeline, so a new image can arrive without leaving this
              page — and no upload code is duplicated here. */}
          <MediaPicker
            name="originMediaId"
            items={library}
            defaultValue={null}
            onSelect={setSelected}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => attach("HERO")}
              className="h-11 min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-forest-light disabled:opacity-60"
            >
              {t("addHero")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => attach("GALLERY")}
              className="h-11 min-h-11 rounded-full border border-border px-5 text-sm font-bold transition hover:border-gold disabled:opacity-60"
            >
              {t("addGallery")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Thumb({ image, untitled }: { image: OriginImage; untitled: string }) {
  return (
    <span className="block size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- a stored object
          can be missing; the optimizer would turn that into its own error
          response rather than a load error. */}
      <img
        src={image.url}
        alt={image.altEn ?? untitled}
        loading="lazy"
        className="size-full object-cover"
      />
    </span>
  );
}

function IconButton({
  label,
  disabled,
  destructive = false,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      // A visible label, not an icon alone: the control is legible at a glance
      // and reads correctly to assistive technology in both languages.
      className={`inline-flex h-11 min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition disabled:opacity-40 ${
        destructive
          ? "border-border hover:border-destructive hover:text-destructive"
          : "border-border hover:border-gold"
      }`}
    >
      {children}
      {label}
    </button>
  );
}
