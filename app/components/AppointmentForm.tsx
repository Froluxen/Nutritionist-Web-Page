"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapDbError } from "@/lib/auth-errors";
import type { AppointmentType, CatalogPlan } from "@/lib/types";

type Purchase = { detailId: string; itemName: string };

type Props = {
  plans: CatalogPlan[];
  purchases: Purchase[];
  appointmentTypes: AppointmentType[];
};

const fieldClass =
  "w-full rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/50 focus:border-leaf focus:bg-sheet focus:outline-none focus:ring-2 focus:ring-leaf/20";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-muted";

export default function AppointmentForm({
  plans,
  purchases,
  appointmentTypes,
}: Props) {
  const [orderDetailId, setOrderDetailId] = useState(purchases[0]?.detailId ?? "");
  const [appointmentTypeId, setAppointmentTypeId] = useState(
    appointmentTypes[0]?.id ?? "",
  );
  const [dateTime, setDateTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const minDateTime = today.toISOString().slice(0, 16);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!orderDetailId) throw new Error("purchase-required");
      if (!appointmentTypeId) throw new Error("type-required");
      const parsed = new Date(dateTime);
      if (Number.isNaN(parsed.getTime())) throw new Error("invalid-date");
      if (parsed <= new Date()) throw new Error("past-date");
      const cleanNotes = notes.trim().slice(0, 500);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("auth-required");

      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        order_detail_id: orderDetailId,
        appointment_type_id: appointmentTypeId,
        date_time: parsed.toISOString(),
        status: "pending",
        notes: cleanNotes || null,
      });
      if (error) throw error;

      setSuccess("¡Cita solicitada! Te contactaremos para confirmarla.");
      setDateTime("");
      setNotes("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "purchase-required")
        setError("Compra un plan primero para agendar tu cita.");
      else if (msg === "type-required") setError("Selecciona el tipo de cita.");
      else if (msg === "invalid-date" || msg === "past-date")
        setError("Elige una fecha y hora futuras válidas.");
      else if (msg === "auth-required")
        setError("Debes iniciar sesión para agendar una cita.");
      else setError(mapDbError(msg));
    } finally {
      setIsLoading(false);
    }
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-sheet p-6 text-center sm:p-8">
        <p className="text-sm text-muted">
          Los planes estarán disponibles próximamente.
        </p>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-sheet p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/50 px-3 py-1 text-xs font-semibold text-ink">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Cita con plan pagado
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight text-ink">
          Primero elige tu plan
        </h3>
        <p className="mt-2 text-sm text-muted">
          La consulta se agenda con un plan pagado. Así llegamos a la cita con un
          plan preparado para ti y no con preguntas sueltas.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink/80">
          {[
            "Compra tu plan y sube el comprobante",
            "Espera la confirmación del pago",
            "Vuelve aquí para reservar día y hora",
          ].map((step) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint text-leaf-deep">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              {step}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="#planes"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
          >
            Ver planes
          </a>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-2xl font-bold text-ink">
          Solicitar cita
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-leaf-deep">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Plan pagado verificado
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Reservamos una hora completa para revisar tu plan y resolver dudas.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="purchase" className={labelClass}>
              Tu compra
            </label>
            <select
              id="purchase"
              required
              value={orderDetailId}
              onChange={(e) => setOrderDetailId(e.target.value)}
              className={fieldClass}
            >
              {purchases.map((p) => (
                <option key={p.detailId} value={p.detailId}>
                  {p.itemName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="appt-type" className={labelClass}>
              Tipo de cita
            </label>
            <select
              id="appt-type"
              required
              value={appointmentTypeId}
              onChange={(e) => setAppointmentTypeId(e.target.value)}
              className={fieldClass}
            >
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.typeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="date-time" className={labelClass}>
            Fecha y hora preferida
          </label>
          <input
            id="date-time"
            type="datetime-local"
            required
            min={minDateTime}
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-muted">
            Reservamos franjas de una hora para evitar cruces con otros pacientes.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Notas (opcional)
          </label>
          <textarea
            id="notes"
            rows={4}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cuéntanos sobre tus objetivos, horarios u otras preferencias…"
            className={`${fieldClass} resize-none`}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-xl bg-mint px-3.5 py-2.5 text-sm font-medium text-leaf-deep"
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {isLoading ? "Agendando…" : "Solicitar cita"}
        </button>
      </form>
    </div>
  );
}
