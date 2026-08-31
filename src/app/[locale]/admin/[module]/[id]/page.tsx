import { notFound } from "next/navigation";
import { AdminRecordEditor } from "@/components/admin/admin-record-editor";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAdminFormOptions, getAdminRecordForEdit } from "@/lib/data/admin";

const editableModules = [
  "products",
  "offers",
  "origins",
  "regions",
  "warehouses",
  "varieties",
  "articles",
  "article-categories",
  "taxonomy",
  "media",
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
    </div>
  );
}
