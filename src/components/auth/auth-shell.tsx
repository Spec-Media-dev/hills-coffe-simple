import { ArrowLeft } from "lucide-react";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function AuthShell({
  eyebrow,
  title,
  body,
  children,
  asideTitle,
  asideBody,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
  asideTitle: string;
  asideBody: string;
}) {
  const locale = await getLocale();
  return (
    <section className="min-h-[calc(100svh-73px)] bg-page">
      <div className="site-container grid min-h-[calc(100svh-73px)] gap-8 py-8 lg:grid-cols-[.85fr_1.15fr]">
        <div className="flex flex-col justify-center py-10">
          <Link
            href="/"
            className="mb-12 inline-flex items-center gap-2 self-start text-sm font-bold text-muted-foreground hover:text-gold"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {locale === "ar" ? "الرئيسية" : "Home"}
          </Link>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-5 font-heading text-5xl leading-none tracking-[-.045em] md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-md leading-7 text-muted-foreground">
            {body}
          </p>
          <div className="mt-9 max-w-md">{children}</div>
        </div>
        <aside className="relative hidden overflow-hidden rounded-[2rem] bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-end">
          <div className="absolute -end-24 -top-24 size-96 rounded-full bg-gold/40 blur-3xl" />
          <div className="absolute start-14 top-16 size-40 rounded-full border-[38px] border-white/5" />
          <div className="relative">
            <p className="eyebrow !text-gold-contrast">
              {locale === "ar" ? "وصول محمي" : "Protected access"}
            </p>
            <h2 className="mt-5 max-w-lg text-5xl leading-tight">
              {asideTitle}
            </h2>
            <p className="mt-6 max-w-md leading-7 text-white/65">{asideBody}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function AuthField({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={type === "password" ? 8 : undefined}
        className="h-12 rounded-xl border border-input bg-card px-4 text-base font-normal normal-case tracking-normal text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </label>
  );
}
