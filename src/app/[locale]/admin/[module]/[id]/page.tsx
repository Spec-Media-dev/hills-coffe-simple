import { notFound } from "next/navigation";
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
  return (
    <div className="p-5 md:p-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/admin">Admin</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/admin/${module}`}>{module.replaceAll("-", " ")}</Link>
        <span aria-hidden="true"> / </span>
        <span>Edit</span>
      </nav>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="mt-4 text-5xl capitalize">
        Edit {module.replaceAll("-", " ")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Record {id}. All changes are validated and authorised on the server.
      </p>
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
