# Hills Coffee

A bilingual, premium green-coffee catalog for Hills Coffee, built with Next.js 16, React 19, `next-intl`, Supabase SSR, shadcn, Tailwind CSS 4, and Motion.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`; locale middleware redirects to `/en`. Arabic is available at `/ar` with document-level RTL.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

## Supabase connection

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The implementation uses SSR cookie sessions, email/password auth, recovery callbacks, verified-email gates, server-side role checks, and Server Actions.

The application uses the approved Post-DB0 objects already present in Supabase: profiles/favourites; coffees, offers, prices, origins, regions, warehouses, and taxonomy; inquiries/history; articles/categories; CMS pages/sections; media; settings; and audit logs. No migration or schema change is included.

Required security rules:

- Public visitors may read public coffee identity and non-price offer metadata only.
- Price columns must never be granted to anonymous clients; expose them through a server-only query/RPC after session verification.
- Customers may read their own profile/inquiries and create inquiries only for themselves.
- Inquiry identity, coffee context, status, timestamps, and snapshots are database-derived; the application sends only allow-listed customer fields and a server-validated offer ID.
- A customer may have one active `SAMPLE_REQUEST` per coffee across all warehouse offers. `NEW`, `RECEIVED`, and `CONTACTED` are active; `CLOSED` permits a new manual-review request.
- Sample requests never create shipments, approvals, inventory reservations, quantities, or automatic fulfillment.
- Admin writes require an `ADMIN` role verified from trusted app metadata/claims, never editable user metadata.
- Storage writes are admin-only; public product imagery may use read-only public delivery.

## Application map

- Public: `/`, `/ar`, `/green-coffee-offer-list`, `/coffee-origins`, `/knowledge`, `/about`, `/contact`, `/request-a-quote`
- Auth/account: `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`
- Protected Admin: `/admin` plus catalog, offers/pricing, inquiries, locations, taxonomy, editorial/CMS, media, settings, users, and audit modules

Public catalog data and protected pricing are separated into dedicated server data modules. Automated tests cover price-leak boundaries, authentication redirects, and the complete sample-request business rule.
