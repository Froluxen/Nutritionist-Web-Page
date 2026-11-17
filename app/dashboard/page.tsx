import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Download,
  ExternalLink,
  ReceiptText,
  Settings,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/components/SignOutButton";
import CancelAppointmentButton from "@/app/components/CancelAppointmentButton";
import CancelOrderButton from "@/app/components/CancelOrderButton";
import {
  APPOINTMENT_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  appointmentStatusClass,
  formatPrice,
  orderStatusClass,
} from "@/lib/types";

type OrderDetailRow = {
  id: string;
  item_id: string;
  paid_price: number;
  items: {
    name: string;
    item_type: "plan" | "ebook";
    ebooks: { file_path: string | null } | null;
  } | null;
};

type OrderRow = {
  id: string;
  status: string;
  total_paid: number;
  reference_code: string;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  order_details: OrderDetailRow[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  const { data: ordersData } = await supabase
    .from("orders")
    .select(
      "id, status, total_paid, reference_code, created_at, cancelled_at, cancelled_by, cancellation_reason, order_details(id, item_id, paid_price, items(name, item_type, ebooks(file_path)))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const orders = (ordersData ?? []) as unknown as OrderRow[];

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, date_time, status, notes, appointment_types(type_name)")
    .eq("user_id", user.id)
    .order("date_time", { ascending: true })
    .limit(20);

  const activeOrders = orders.filter((o) => o.status === "pending").length;
  const upcomingAppointments = (appointments ?? []).filter(
    (a) =>
      (a.status === "pending" || a.status === "confirmed") &&
      new Date(a.date_time).getTime() >= new Date().getTime(),
  ).length;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tracking-[-0.04em]">
              NutriWeb
            </span>
            <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Link
                href="/dashboard/admin"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Administrar
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-8 text-paper sm:px-10 sm:py-10">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-4 top-10 h-40 w-40 rounded-full bg-leaf/30 blur-2xl"
            aria-hidden="true"
          />

          <p className="relative inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-paper/70">
            <Sparkles className="h-3.5 w-3.5 text-lime" aria-hidden="true" />
            Mi panel
          </p>
          <h1 className="relative mt-4 font-display text-[clamp(1.9rem,4.2vw,2.8rem)] font-extrabold leading-tight">
            Hola, {profile?.full_name ?? user.email}
          </h1>
          <p className="relative mt-2 max-w-xl text-sm text-paper/60">
            {user.email}
          </p>

          <div className="relative mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-paper/80">
              {orders.length} {orders.length === 1 ? "compra" : "compras"}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-paper/80">
              {upcomingAppointments}{" "}
              {upcomingAppointments === 1 ? "cita próxima" : "citas próximas"}
            </span>
            {activeOrders > 0 && (
              <span className="rounded-full bg-lime px-3 py-1.5 font-semibold text-ink">
                {activeOrders}{" "}
                {activeOrders === 1 ? "pago pendiente" : "pagos pendientes"}
              </span>
            )}
          </div>
        </section>

        {activeOrders > 0 && (
          <p className="mt-4 rounded-2xl border border-lime bg-lime/25 px-4 py-3 text-sm text-ink">
            Tienes {activeOrders}{" "}
            {activeOrders === 1 ? "orden pendiente" : "órdenes pendientes"} de
            pago. {activeOrders === 1 ? "Complétala" : "Complétalas"} para habilitar
            tus descargas y citas.
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-start">
          <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-leaf-deep">
                  <ReceiptText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-ink">
                    Mis compras
                  </h2>
                  <p className="text-xs text-muted">
                    Órdenes, descargas y estado de pago.
                  </p>
                </div>
              </div>
              <Link
                href="/#planes"
                className="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:text-leaf-deep"
              >
                Ver catálogo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-paper/50 p-8 text-center">
                <p className="font-display text-lg font-bold text-ink">
                  Aún no tienes compras
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  Explora los planes y eBooks para empezar tu acompañamiento.
                </p>
                <Link
                  href="/#planes"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
                >
                  Explorar planes
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {orders.map((o) => {
                  const details = o.order_details ?? [];
                  const hasPending = o.status === "pending";
                  return (
                    <li
                      key={o.id}
                      className={`rounded-2xl border p-4 ${
                        hasPending
                          ? "border-lime bg-lime/15"
                          : "border-line bg-paper/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-ink">
                            {o.reference_code}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${orderStatusClass(o.status)}`}
                          >
                            {ORDER_STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </div>
                        <span className="text-xs text-muted">
                          {new Date(o.created_at).toLocaleDateString("es-BO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
                        {details.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span>
                              {d.items?.name ?? "Producto"} —{" "}
                              {formatPrice(Number(d.paid_price))}
                            </span>
                            {o.status === "paid" &&
                              d.items?.item_type === "ebook" &&
                              d.items.ebooks?.file_path && (
                                <a
                                  href={`/downloads/${d.item_id}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-leaf-deep transition hover:bg-mint/70"
                                >
                                  <Download
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Descargar
                                </a>
                              )}
                          </li>
                        ))}
                      </ul>

                      {o.status === "cancelled" && (
                        <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-xs text-muted">
                          {o.cancelled_by === user.id
                            ? "Cancelaste esta orden"
                            : "La nutricionista rechazó esta orden"}
                          {o.cancellation_reason
                            ? ` · Motivo: ${o.cancellation_reason}`
                            : ""}
                          .
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                        <span className="text-sm font-semibold text-ink">
                          Total: {formatPrice(Number(o.total_paid))}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {hasPending && <CancelOrderButton orderId={o.id} />}
                          <Link
                            href={`/pagar/${o.id}`}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                              hasPending
                                ? "bg-ink text-paper hover:bg-leaf-deep"
                                : "border border-line text-ink hover:bg-sheet"
                            }`}
                          >
                            {hasPending ? "Completar pago" : "Ver orden"}
                            <ExternalLink
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="space-y-5">
            <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-leaf-deep">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-ink">
                    Mis citas
                  </h2>
                  <p className="text-xs text-muted">Solo con un plan pagado.</p>
                </div>
              </div>

              {!appointments || appointments.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-line bg-paper/50 p-5 text-center">
                  <p className="text-sm text-muted">
                    No tienes citas agendadas todavía.
                  </p>
                  <Link
                    href="/#agendar"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper"
                  >
                    Agendar una cita
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {appointments.map((a) => {
                    const active =
                      a.status === "pending" || a.status === "confirmed";
                    return (
                      <li
                        key={a.id}
                        className="rounded-2xl border border-line bg-paper/40 p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-paper">
                            <span className="text-[0.6rem] uppercase leading-none">
                              {new Date(a.date_time)
                                .toLocaleDateString("es-BO", { month: "short" })
                                .replace(".", "")}
                            </span>
                            <span className="font-display text-sm font-bold leading-tight">
                              {new Date(a.date_time).getDate()}
                            </span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold text-ink">
                                {new Date(a.date_time).toLocaleTimeString("es-BO", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${appointmentStatusClass(a.status)}`}
                              >
                                {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {(a.appointment_types as any)?.type_name ?? "Consulta"}
                              {a.notes ? ` — ${a.notes}` : ""}
                            </p>
                            {active && (
                              <div className="mt-2">
                                <CancelAppointmentButton id={a.id} />
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-line bg-mint p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-leaf-deep">
                ¿Necesitas ayuda?
              </h2>
              <p className="mt-1 text-sm text-leaf-deep/80">
                Si tienes dudas con un pago, una descarga o tu cita, escríbenos
                indicando tu código de referencia.
              </p>
              <Link
                href="/#agendar"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
              >
                Ir a la agenda
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          </div>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full border border-line bg-sheet px-6 py-3 text-sm font-medium text-ink transition hover:bg-mint/50"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
