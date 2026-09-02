import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MediaActions } from "@/components/admin/media-actions";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  findMediaReferences,
  getMediaItem,
  storageObjectExists,
} from "@/lib/data/media-library";

export const metadata: Metadata = {
  title: "Media detail",
  robots: { index: false, follow: false },
};

/**
 * One media item: what it is, where it is used, and what happens if it goes.
 *
 * The usage list is computed on every view rather than cached, because it is
 * the thing an Admin is about to make an irreversible-feeling decision on.
 */
export default async function AdminMediaDetailPage({
  params,
}: PageProps<"/[locale]/admin/media/[id]">) {
  const { id, locale } = (await params) as { id: string; locale: Locale };
  const t = await getTranslations("admin.media");

  const item = await getMediaItem(id);
  // A non-Admin and a missing id reach the same 404.
  if (!item) notFound();

  const [references, objectExists] = await Promise.all([
    findMediaReferences(id),
    storageObjectExists(item),
  ]);

  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const kb = item.sizeBytes ? Math.round(item.sizeBytes / 1024) : null;

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/media"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl md:text-4xl">{item.altEn || t("untitled")}</h1>
        {item.archived ? (
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
            {t("archivedBadge")}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-muted-foreground">{t("detailTitle")}</p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <section className="grid gap-4 rounded-2xl border border-border bg-card p-6">
          <span className="block overflow-hidden rounded-xl bg-muted">
            {objectExists ? (
              /* A stored object can be missing; the optimizer would turn that
                 into its own error response rather than a load error. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.altEn ?? ""}
                className="h-auto w-full object-contain"
              />
            ) : (
              <span className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-6 text-center">
                <AlertTriangle
                  className="size-6 text-amber-600"
                  aria-hidden="true"
                />
                {/* Stated plainly: a row whose object is gone shows this, not
                    a broken-image icon. */}
                <span className="text-sm font-medium text-muted-foreground">
                  {t("objectMissing")}
                </span>
              </span>
            )}
          </span>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="font-bold">{t("dimensions")}</dt>
              <dd dir="ltr">
                {item.width && item.height
                  ? `${item.width} × ${item.height}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">{t("fileType")}</dt>
              <dd dir="ltr">{item.mimeType ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">{t("fileSize")}</dt>
              <dd dir="ltr">{kb ? `${kb} KB` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">{t("uploaded")}</dt>
              <dd>{dateFormat.format(new Date(item.createdAt))}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-bold">{t("path")}</dt>
              <dd dir="ltr" className="break-all text-xs text-muted-foreground">
                {item.storagePath}
              </dd>
            </div>
          </dl>
        </section>

        <div className="grid gap-5">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl">{t("usageTitle")}</h2>
            {references.length ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("usageCount", { count: references.length })}
                </p>
                <ul className="mt-4 grid gap-2 text-sm">
                  {references.map((reference, index) => (
                    <li
                      key={`${reference.kind}-${index}`}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-4 py-3"
                    >
                      <strong>
                        {t(
                          `usage${reference.kind[0].toUpperCase()}${reference.kind.slice(1)}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </strong>
                      {reference.label ? (
                        <span className="text-muted-foreground">
                          {reference.label}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("usageNone")}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <MediaActions
              mediaId={item.id}
              archived={item.archived}
              references={references}
              altEn={item.altEn}
              altAr={item.altAr}
              captionEn={item.captionEn}
              captionAr={item.captionAr}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
