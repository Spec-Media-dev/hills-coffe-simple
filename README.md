# Hills Coffee

A bilingual, premium green-coffee catalog for Hills Coffee, built with Next.js 16, React 19, `next-intl`, Supabase SSR, shadcn, Tailwind CSS 4, and Motion.

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`; locale middleware redirects to `/en`. Arabic is available at `/ar` with document-level RTL.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

## Supabase connection

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The implementation uses SSR cookie sessions, email/password auth, recovery callbacks, server-side role checks, and Server Actions.

No database migration was created because the product brief requires schema approval first. The UI expects these approved resources:

- `product_inquiries`: `id`, `user_id`, `coffee_id`, `offering_id`, `warehouse`, `quantity_bags`, `message`, `created_at`, `status`.
- `contact_inquiries`: `id`, `name`, `email`, `company`, `location`, `message`, `created_at`, `status`.
- Future catalog tables: `coffees`, `offers`, `origins`, `locations`, `processes`, `certifications`, `tags`, `sensory_terms`, and `packaging`.
- A profile table keyed to `auth.users` for `full_name`, `company`, and application metadata as needed.
- Storage buckets for approved editorial and product media.

Required security rules:

- Public visitors may read public coffee identity and non-price offer metadata only.
- Price columns must never be granted to anonymous clients; expose them through a server-only query/RPC after session verification.
- Customers may read their own profile/inquiries and create inquiries only for themselves.
- `user_id` and `created_at` must be server-derived; offer relationships must be validated against catalog data.
- Admin writes require an `ADMIN` role verified from trusted app metadata/claims, never editable user metadata.
- Storage writes are admin-only; public product imagery may use read-only public delivery.

The `HILLS_USER_PREVIEW` and `HILLS_ADMIN_PREVIEW` switches are local visual-QA helpers. They are ignored outside development and default to `false`.

## Application map

- Public: `/[locale]`, `/products`, `/products/[slug]`, `/about`, `/contact`
- Auth: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/account`
- Protected admin: `/admin` plus products, offers, inquiries, origins, taxonomy, users, content, and settings modules

Catalog data is isolated in `src/data`. Protected demo pricing lives in a separate `server-only` module and is stripped from unauthenticated payloads. Automated tests cover that policy and trusted inquiry context resolution.
