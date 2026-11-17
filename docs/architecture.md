# NutriWeb — Architecture (C4)

> Documentation of the overall software architecture of **NutriWeb**, a
> nutrition-advisory website (selling Plans & eBooks, booking appointments
> tied to purchases, and an admin catalog panel).
>
> Generated with the **C4 model** at two levels: **System Context (L1)** and
> **Containers (L2)**. Diagrams are ASCII (asciiflow-style), readable in any
> editor/terminal.

---

## 1. Overview

NutriWeb follows a **server-centric Next.js architecture paired with
Supabase as Backend-as-a-Service**. There is **no self-hosted backend**: the
Next.js App Router (Server Components, Server Actions, Route Handlers and a
root `proxy.ts` middleware) is the only application runtime. Supabase
provides **authentication** (GoTrue) and the **relational database**
(PostgreSQL) with **Row Level Security (RLS)** as the authorization layer.

Layers at a glance:

| Layer            | Technology                                                |
| ---------------- | --------------------------------------------------------- |
| Client UI        | React 19, Next.js 16 App Router, Tailwind CSS 4, Lucide   |
| Server / SSR     | Next.js 16 — Server Components, Server Actions, middleware |
| Auth             | Supabase Auth (GoTrue) — email/password + magic links      |
| Database         | Supabase PostgreSQL — RLS, triggers, enums, functions      |
| Analytics / Logs | None (out of scope)                                       |

---

## 2. Level 1 — System Context Diagram (`C1`)

```text
+--------------------------------------------------------------------+
|                         USERS (People)                             |
|                                                                    |
|   [Visitor]                 [Patient]           [Admin / Nutri.]   |
|   sees public              buys plans/          manages catalog,   |
|   catalog only             eBooks & books      sees all orders     |
|                            appointments         & appointments     |
+--------------------------------------------------------------------+
      |                         |                         |
      |  browse (public)        |  buy / book (auth)      |  admin (auth+role)
      v                         v                         v
+-------------------------------------------------------------------------+
|                 [Software System]  NUTRIWEB (SPA)                       |
|                                                                         |
|   Next.js 16 + React 19: Server Components (SSR), Server Actions,       |
|   Route Handlers (auth/confirm), Middleware (proxy.ts)                  |
+-------------------------------------------------------------------------+
      |                                                       |
      |  HTTPS — auth REST (JWT, OTP, session)                |  HTTPS — PostgREST (SQL-over-HTTP)
      v                                                       v
+----------------------------+                  +----------------------------+
| [External System]          |                  | [External System]          |
|   SUPABASE Auth (GoTrue)   |                  |   SUPABASE Postgres        |
|   email/password sign-in   |                  |   RLS policies, triggers,  |
|   magic-link confirmation  |                  |   tables, enums, seeds     |
+----------------------------+                  +----------------------------+

[External build dependency]  Google Fonts (Bricolage Grotesque + Instrument Sans) — fetched via next/font at build time.

Legend:  [Person]  [Software System]  [External System / Dependency]
```

> Note: **no payment gateway** is integrated. Orders are created with a
> `pending` status and a `payment_method` label (`cash | transfer | card |
> qr | other`); payment itself happens out-of-band.

---

## 3. Level 2 — Container Diagram (`C2`)

```text
+--------------------------------------------------------------+
|                            USERS                             |
|   [Visitor]               [Patient]           [Admin/Nutri.] |
+--------------------------------------------------------------+
       |                       |                       |
       v                       v                       v
+--------------------------------------------------------------+
|        [Container]  NEXT.JS APPLICATION SERVER               |
|   Next.js 16 App Router - the only application runtime       |
|                                                              |
|   Server Components (SSR):                                   |
|     - / landing page        (catalog, user purchases)        |
|     - /dashboard (patient)  (orders, appointments)           |
|     - /dashboard/admin      (overview, payments, catalog, appointments, settings) |
|     - /auth/login, /auth/confirm                             |
|                                                              |
|   Server Actions:                                            |
|     - orders.ts -> createOrder()                             |
|     - auth.ts   -> signOut()                                 |
|     - payments.ts -> confirmPaymentAction(), cancelOrderAction() |
|     - appointments.ts -> setAppointmentStatusAction()        |
|     - settings.ts -> savePaymentSettings() (QR + bank data)  |
|                                                              |
|   Middleware:  proxy.ts - JWT session refresh, route guard,  |
|                admin RBAC check (profiles.role)              |
|                                                              |
|   Client Components (browser):                               |
|     - BuyButton, AppointmentForm, ItemsManager               |
|     - login / register pages                                 |
|                                                              |
|   Supabase connectivity: auth REST + PostgREST (HTTPS)       |
+--------------------------------------------------------------+
       |                                              |
       |  auth REST (signIn/up, OTP, getUser)         |  PostgREST SQL-over-HTTP
       v                                              v
+--------------------------+       +---------------------------+
| [Container] Supabase Auth|       | [Container] PostgreSQL DB |
|   email/password sign-in |       |   profiles, items, plans, |
|   JWT session tokens,    |       |   ebooks, features,       |
|   magic-link emails,     |       |   orders, order_details,  |
|   auth.users (source of  |       |   appointments            |
|   truth)                 |       |                           |
|                          |       |   RLS policies, triggers, |
|                          |       |   enums, seeds, funcs     |
+--------------------------+       +---------------------------+

[Data sync]  Supabase Auth writes to auth.users; the DB trigger
             handle_new_user() auto-creates a row in profiles per signup.

[External build dependency]  Google Fonts (Bricolage Grotesque + Instrument Sans) - fetched via next/font at build time.

Legend:  [Person]  [Container]  [External System / Container]
```

### 3.1 Container responsibilities

- **Next.js App Server**
  - Renders pages, executes Server Actions, guards routes via `proxy.ts`.
  - Talks to Supabase with the **server client** (`lib/supabase/server.ts`).
  - Hands session state to the browser via cookies (set by Supabase SSR).
- **Supabase Auth (GoTrue)**
  - Identity provider; issues JWTs; sends confirmation emails.
  - `auth.users` is the source of truth for identities.
  - A DB **trigger** (`handle_new_user`) auto-creates a `profiles` row.
- **Supabase Postgres**
  - Holds all business data; enforces **RLS** so the browser can only see
    its own rows / public active catalog items; fixes `paid_price` via
    trigger; validates plan/ebook subclass coherence.

---

## 4. External architectural dependencies

| Dependency                     | Kind              | Used for                                                        | Ingress/egress                                   |
| ------------------------------ | ----------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| **Supabase Auth (GoTrue)**     | External SaaS     | Email/password auth, JWT sessions, magic-link email confirmation | HTTPS REST (browser + server)                    |
| **Supabase Postgres**          | External SaaS     | Persistence + RLS authorization + triggers/functions             | HTTPS (PostgREST) from app and browser           |
| **Supabase Storage**           | External SaaS     | Buckets: `ebooks` and `payment-proofs` (private, signed URLs) and `assets` (public QR image, admin-only writes) | Storage API from browser/server |
| **Google Fonts (Bricolage Grotesque + Instrument Sans)** | External CDN      | Font loading (`next/font/google` at build time)                  | CDN at build/asset time                          |
| **NPM packages**               | Build dependency  | `next`, `react`, `@supabase/*`, `lucide-react`, `tailwindcss`, `eslint` | Fetch at install/CI |
| Payment gateways               | **Not integrated**| Orders are labeled `pending` + `payment_method`; marking paid is manual | — |

### Runtime flow between layers

1. **Visit / catalog (public)**
   Browser → `GET /` → Server Component reads `items` / `plans` / `ebooks` /
   `appointment_types` via the Supabase server client (RLS returns only
   `status = true` rows) → SSR HTML.

2. **Register / Login**
   Client page → `supabase.auth.signUp / signInWithPassword` (browser
   client). On signup, Supabase emails a confirmation link → `/auth/confirm`
   Route Handler exchanges the code for a session cookie.

3. **Route guarding (every request)**
   `proxy.ts` middleware refreshes the session (rotates JWT/cookies) and
   enforces auth (redirects `/dashboard` → `/auth/login`, logged-in users
   away from `/auth*`, non-admin away from `/dashboard/admin`). It queries
   `profiles` for the admin role check.

4. **Buy a plan**
   `BuyButton` (client) → Server Action `createOrder` (server client):
   checks user + active item, inserts `orders` (pending, payment_method,
   total = item.price) then `order_details` (trigger `fix_paid_price` fixes
   the historical `paid_price`).

5. **Book an appointment**
   `AppointmentForm` (client) inserts into `appointments` directly from the
   browser; **RLS policy** guarantees the chosen `order_detail_id` belongs
   to the logged-in user (appointment only after purchase).

6. **Admin operations**
   `ItemsManager` (client) does CRUD over `items` + `ebooks` / `plans` and
   uploads eBook PDFs to `<item_id>/...` in the private `ebooks` bucket.
   `PaymentsQueue`, `AppointmentsManager` and `PaymentSettingsForm` call
   Server Actions; RLS approves writes only when `is_admin()` returns true.
   The QR image is stored in the public `assets` bucket and its path lives in
   the single-row `settings` table (env vars are only a fallback).

7. **Dashboard**
   Server Component reads `orders` + `order_details` + `appointments` for
   the current user (RLS-scoped to `auth.uid()`).

---

## 5. Security notes (as implemented)

- **RLS is deny-by-default**: every table has explicit policies.
- Admin check uses a `SECURITY DEFINER` function (`is_admin()`) to avoid
  recursive policy evaluation.
- Client-side auth calls are user-scoped by RLS; Server Actions use the
  authenticated server client (not the anon key).
- Secrets: only the **publishable** key is exposed to the browser
  (`NEXT_PUBLIC_...`); the service-role key is **not** used anywhere.

## 6. Observations / current limitations

- No backend business-logic layer (no external API / worker) — rule
  enforcement lives in **Postgres triggers + RLS + Server Actions**.
- No payment gateway / webhook; the `paid` status is not automated.
- No analytics, logging, or observability integration.
- eBooks are delivered as raw `file_url` links (no signed-URL protection yet).
- All flows are synchronous; no queues or background jobs.