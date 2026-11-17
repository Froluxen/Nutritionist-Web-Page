"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Phone,
  XCircle,
} from "lucide-react";
import {
  cancelAppointmentAction,
  setAppointmentStatusAction,
} from "@/app/actions/appointments";
import { APPOINTMENT_STATUS_LABEL, appointmentStatusClass } from "@/lib/types";

export type AdminAppointment = {
  id: string;
  dateTime: string;
  status: string;
  notes: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  typeName: string;
  itemName: string | null;
  referenceCode: string | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-BO", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function AppointmentCard({ appointment }: { appointment: AdminAppointment }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "complete" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active =
    appointment.status === "pending" || appointment.status === "confirmed";
  const isPast = new Date(appointment.dateTime).getTime() < new Date().getTime();

  async function run(action: "confirm" | "complete" | "cancel") {
    const question =
      action === "cancel"
        ? `¿Cancelar la cita de ${
            appointment.customerName ?? appointment.customerEmail ?? "este paciente"
          }?`
        : action === "confirm"
          ? "¿Confirmar esta cita con el paciente?"
          : "¿Marcar esta cita como completada?";

    if (!window.confirm(question)) return;

    setBusy(action);
    setError(null);

    try {
      const result =
        action === "cancel"
          ? await cancelAppointmentAction(appointment.id)
          : await setAppointmentStatusAction(
              appointment.id,
              action === "confirm" ? "confirmed" : "completed",
            );

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-3xl border border-line bg-sheet p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-ink">
              {appointment.customerName ?? "Paciente"}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${appointmentStatusClass(
                appointment.status,
              )}`}
            >
              {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
            </span>
            {isPast && active && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                Fecha pasada
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {appointment.customerEmail ?? "—"}
            {appointment.customerPhone && (
              <>
                <Phone className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                {appointment.customerPhone}
              </>
            )}
          </p>
        </div>

        <p className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink">
          <Clock3 className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
          {formatDateTime(appointment.dateTime)}
        </p>
      </div>

      <dl className="mt-4 grid gap-2 rounded-2xl bg-paper/70 p-3.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
            Tipo de cita
          </dt>
          <dd className="text-ink">{appointment.typeName}</dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
            Compra asociada
          </dt>
          <dd className="text-ink">
            {appointment.itemName ?? "Plan"}
            {appointment.referenceCode && (
              <span className="ml-1 font-mono text-xs text-muted">
                ({appointment.referenceCode})
              </span>
            )}
          </dd>
        </div>
        {appointment.notes && (
          <div className="sm:col-span-2">
            <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
              Notas del paciente
            </dt>
            <dd className="mt-0.5 text-ink/80 italic">“{appointment.notes}”</dd>
          </div>
        )}
      </dl>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {active && (
        <div className="mt-4 flex flex-wrap gap-2">
          {appointment.status === "pending" && (
            <button
              type="button"
              onClick={() => run("confirm")}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:opacity-60"
            >
              {busy === "confirm" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
              )}
              Confirmar cita
            </button>
          )}

          {appointment.status === "confirmed" && (
            <button
              type="button"
              onClick={() => run("complete")}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-white transition hover:bg-leaf-deep disabled:opacity-60"
            >
              {busy === "complete" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
              )}
              Marcar completada
            </button>
          )}

          <button
            type="button"
            onClick={() => run("cancel")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
          >
            {busy === "cancel" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4" aria-hidden="true" />
            )}
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-line bg-sheet p-6 text-center text-sm text-muted">
      {text}
    </p>
  );
}

export default function AppointmentsManager({
  appointments,
}: {
  appointments: AdminAppointment[];
}) {
  const pending = appointments.filter((a) => a.status === "pending");
  const confirmed = appointments
    .filter((a) => a.status === "confirmed")
    .sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    );
  const closed = appointments.filter(
    (a) => a.status === "completed" || a.status === "cancelled",
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <Clock3 className="h-5 w-5 text-leaf" aria-hidden="true" />
          Por confirmar ({pending.length})
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Solicitudes nuevas de pacientes con plan pagado.
        </p>
        {pending.length === 0 ? (
          <div className="mt-4">
            <EmptyState text="No hay solicitudes esperando confirmación." />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <CheckCircle2 className="h-5 w-5 text-leaf" aria-hidden="true" />
          Confirmadas ({confirmed.length})
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Citas agendadas. Márcalas como completadas después de la consulta.
        </p>
        {confirmed.length === 0 ? (
          <div className="mt-4">
            <EmptyState text="Todavía no confirmaste ninguna cita." />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {confirmed.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            Historial ({closed.length})
          </h2>
          <ul className="mt-4 space-y-2">
            {closed.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-sheet px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {appointment.customerName ?? appointment.customerEmail ?? "Paciente"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(appointment.dateTime)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${appointmentStatusClass(
                    appointment.status,
                  )}`}
                >
                  {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
