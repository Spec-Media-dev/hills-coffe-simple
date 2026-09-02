import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminRecordEditor } from "@/components/admin/admin-record-editor";
import { OriginMedia } from "@/components/admin/origin-media";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAdminFormOptions, getAdminRecordForEdit } from "@/lib/data/admin";
import { listPickableMedia } from "@/lib/data/media-library";
import { getOriginImages } from "@/lib/data/origin-media";

const editableModules = [
  // "products" and "offers" edit through their own workspace routes.
  "origins",
  "regions",
  "warehouses",
  "varieties",
  // "articles" edit through `admin/articles/[id]`.
  "article-categories",
  "taxonomy",
  // "media" edits through `admin/media/[id]`.
] as const;

export default async function AdminRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; module: string; id: string }>;
  searchParams: Promise<{ entity?: string }>;
}) {
  const { locale, module, id } = await params;
  const query = await searchParams;
  if (!editableModules.includes(module as (typeof editableModules)[number]))
    notFound();
  const [record, options] = await Promise.all([
    getAdminRecordForEdit(module, id, query.entity),
    getAdminFormOptions(locale),
  ]);
  if (!record) notFound();

  // Origins carry images on the existing `origin_media` relation, managed
  // with the shared media library and picker (finding N61). Loaded only for
  // that module.
  const [originImages, mediaLibrary] =
    module === "origins"
      ? await Promise.all([getOriginImages(id), listPickableMedia()])
      : [[], []];
  const t = await getTranslations("admin.modules");
  // The heading used to be the raw route slug, untranslated in both
  // languages; the breadcrumb and the body copy were hardcoded English.
  const titles: Record<string, string> = {
    origins: "originsTitle",
    regions: "regionsTitle",
    varieties: "varietiesTitle",
    warehouses: "warehousesTitle",
    taxonomy: "taxonomyTitle",
    "article-categories": "articleCategoriesTitle",
  };
  const moduleName = t(
    (titles[module] ?? "breadcrumbEdit") as Parameters<typeof t>[0],
  );

  return (
    <div className="p-5 md:p-8">
      <nav
        aria-label={t("breadcrumbAdmin")}
        className="text-sm text-muted-foreground"
      >
        <Link href="/admin" className="hover:text-foreground">
          {t("breadcrumbAdmin")}
        </Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <Link href={`/admin/${module}`} className="hover:text-foreground">
          {moduleName}
        </Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span>{t("breadcrumbEdit")}</span>
      </nav>

      <Link
        href={`/admin/${module}`}
        className="mt-4 inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>

      <h1 className="mt-4 text-4xl md:text-5xl">
        {t("editTitle", { module: moduleName })}
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("editIntro")}</p>
      <AdminRecordEditor
        module={module}
        recordId={id}
        values={record}
        options={options}
      />
      {module === "origins" ? (
        <OriginMedia
          originId={id}
          images={originImages}
          library={mediaLibrary.map((item) => ({
            id: item.id,
            url: item.url,
            width: item.width,
            height: item.height,
            altEn: item.altEn,
            altAr: item.altAr,
            storagePath: item.storagePath,
          }))}
        />
      ) : null}
    </div>
  );
}
