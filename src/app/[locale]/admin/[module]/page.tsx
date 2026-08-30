import { notFound } from "next/navigation";
import { coffees } from "@/data/coffees";

const modules = [
  "products",
  "offers",
  "inquiries",
  "origins",
  "taxonomy",
  "users",
  "content",
  "settings",
] as const;
export function generateStaticParams() {
  return modules.map((module) => ({ module }));
}
export default async function AdminModulePage({
  params,
}: PageProps<"/[locale]/admin/[module]">) {
  const { module, locale } = await params;
  if (!modules.includes(module as (typeof modules)[number])) notFound();
  const offers = coffees.flatMap((coffee) =>
    coffee.offers.map((offer) => ({ coffee: coffee.name.en, ...offer })),
  );
  const rows =
    module === "products"
      ? coffees.map((x) => ({
          primary: x.name.en,
          secondary: x.origin,
          detail: x.process,
          status: x.category,
        }))
      : module === "offers"
        ? offers.map((x) => ({
            primary: x.reference,
            secondary: x.coffee,
            detail: x.warehouse,
            status: x.status,
          }))
        : [];
  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{locale === "ar" ? "العمليات" : "Operations"}</p>
      <div className="mt-4 flex items-end justify-between">
        <h1 className="font-heading text-5xl capitalize">{module}</h1>
        <button className="h-10 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground">
          {locale === "ar" ? "إضافة سجل" : "Add record"}
        </button>
      </div>
      <div className="mt-9 overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.primary}
              className="grid gap-2 border-b border-border p-5 last:border-0 sm:grid-cols-[1.2fr_1fr_1fr_.7fr] sm:items-center"
            >
              <strong>{row.primary}</strong>
              <span className="text-sm text-muted-foreground">
                {row.secondary}
              </span>
              <span className="text-sm">{row.detail}</span>
              <span className="justify-self-start rounded-full bg-muted px-3 py-1 text-xs font-bold capitalize">
                {row.status}
              </span>
            </div>
          ))
        ) : (
          <div className="py-24 text-center">
            <p className="font-heading text-3xl">
              {locale === "ar"
                ? "الوحدة جاهزة للربط مع Supabase"
                : "Module ready for Supabase"}
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {locale === "ar"
                ? "الواجهة والمسار المحمي جاهزان. اربط الجدول المعتمد قبل إدارة السجلات."
                : "The interface and protected route are ready. Connect the approved table before records can be managed."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
