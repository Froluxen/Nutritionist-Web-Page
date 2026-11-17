import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Package,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/types";

type NextAppointment = {
  id: string;
  date_time: string;
  status: string;
  profiles: { full_name: string | null; email: string | null } | null;
  appointment_types: { type_name: string } | null;
};

type PendingOrder = {
  id: string;
  reference_code: string;
  total_paid: number;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminHomePage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    { count: pendingPayments },
    { data: paidOrders },
    { count: pendingAppointments },
    { count: upcomingAppointments },
    { count: activeItems },
    { data: nextAppointments },
    { data: recentPending },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("orders").select("total_paid").eq("status", "paid").limit(1000),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "confirmed"])
      .gte("date_time", now),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("status", true),
    supabase
      .from("appointments")
      .select(
        "id, date_time, status, profiles!appointments_user_id_fkey(full_name, email), appointment_types(type_name)",
      )
      .in("status", ["pending", "confirmed"])
      .gte("date_time", now)
      .order("date_time", { ascending: true })
      .limit(4),
    supabase
      .from("orders")
      .select(
        "id, reference_code, total_paid, created_at, profiles!orders_user_id_fkey(full_name, email)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const confirmedRevenue = (paidOrders ?? []).reduce(
    (sum, row) => sum + Number(row.total_paid ?? 0),
    0,
  );

  const appointments = (nextAppointments ?? []) as unknown as NextAppointment[];
  const pending = (recentPending ?? []) as unknown as PendingOrder[];

  const metrics = [
    {
      label: "Pagos por revisar",
      value: String(pendingPayments ?? 0),
      hint: "Comprobantes en cola",
      href: "/dashboard/admin/pagos",
      icon: CreditCard,
    },
    {
      label: "Ventas confirmadas",
      value: formatPrice(confirmedRevenue),
      hint: "Total histórico",
      icon: TrendingUp,
    },
    {
      label: "Citas por confirmar",
      value: String(pendingAppointments ?? 0),
      hint: `${upcomingAppointments ?? 0} próximas en agenda`,
      href: "/dashboard/admin/citas",
      icon: CalendarClock,
    },
    {
      label: "Productos activos",
      value: String(activeItems ?? 0),
      hint: "Planes y eBooks publicados",
      href: "/dashboard/admin/catalogo",
      icon: Package,
    },
  ];

  const quickLinks = [
    {
      href: "/dashboard/admin/pagos",
      title: "Revisar pagos",
      text: "Confirma transferencias y libera descargas y citas.",
      icon: CreditCard,
    },
    {
      href: "/dashboard/admin/catalogo",
      title: "Editar catálogo",
      text: "Crea planes, sube PDFs y publica eBooks.",
      icon: Package,
    },
    {
      href: "/dashboard/admin/ajustes",
      title: "Ajustar cobros",
      text: "Sube el QR del banco y actualiza los datos de pago.",
      icon: Settings2,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-leaf">Panel de administración</p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-extrabold leading-tight text-ink">
            Todo lo que pasa en NutriWeb
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Revisa pagos, gestiona el catálogo y acompaña las citas desde un solo
            lugar.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-sheet px-4 py-2 text-sm font-medium text-ink transition hover:border-leaf/40"
        >
          Ver sitio
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      <section aria-label="Métricas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, hint, href, icon: Icon }) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  {label}
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-leaf-deep">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">
                {value}
              </p>
              <p className="mt-1 text-xs text-muted">{hint}</p>
            </>
          );

          return href ? (
            <Link
              key={label}
              href={href}
              className="rounded-3xl border border-line bg-sheet p-5 transition hover:border-leaf/40 hover:shadow-soft"
            >
              {body}
            </Link>
          ) : (
            <div key={label} className="rounded-3xl border border-line bg-sheet p-5">
              {body}
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-ink">
                Pagos recientes
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                Órdenes pendientes de verificación.
              </p>
            </div>
            <Link
              href="/dashboard/admin/pagos"
              className="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:text-leaf-deep"
            >
              Ver cola
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {pending.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              No hay pagos esperando revisión. Todo al día.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {pending.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-ink">
                      {order.reference_code}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {order.profiles?.full_name ??
                        order.profiles?.email ??
                        "Cliente"}{" "}
                      ·{" "}
                      {new Date(order.created_at).toLocaleDateString("es-BO", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <span className="font-display text-lg font-bold text-ink">
                    {formatPrice(Number(order.total_paid))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-ink">
                Próximas citas
              </h2>
              <p className="mt-0.5 text-sm text-muted">Agenda de los siguientes días.</p>
            </div>
            <Link
              href="/dashboard/admin/citas"
              className="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:text-leaf-deep"
            >
              Gestionar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {appointments.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              No hay citas próximas agendadas.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {appointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-start gap-3 rounded-2xl bg-paper/70 p-3.5"
                >
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-paper">
                    <span className="text-[0.6rem] uppercase leading-none">
                      {new Date(appointment.date_time)
                        .toLocaleDateString("es-BO", { month: "short" })
                        .replace(".", "")}
                    </span>
                    <span className="font-display text-sm font-bold leading-tight">
                      {new Date(appointment.date_time).getDate()}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {appointment.profiles?.full_name ??
                        appointment.profiles?.email ??
                        "Paciente"}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {appointment.appointment_types?.type_name ?? "Consulta"} ·{" "}
                      {new Date(appointment.date_time).toLocaleTimeString("es-BO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                      appointment.status === "confirmed"
                        ? "bg-mint text-leaf-deep"
                        : "bg-lime/50 text-ink"
                    }`}
                  >
                    {appointment.status === "confirmed" ? "Confirmada" : "Pendiente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Accesos rápidos" className="grid gap-3 md:grid-cols-3">
        {quickLinks.map(({ href, title, text, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-3xl border border-line bg-ink p-5 text-paper transition hover:bg-ink-soft"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="flex items-center gap-1.5 font-display text-lg font-bold">
                {title}
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-1 block text-sm text-paper/60">{text}</span>
            </span>
          </Link>
        ))}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        Recuerda confirmar las citas antes de la consulta y completarlas al
        terminar.
      </p>
    </div>
  );
}
