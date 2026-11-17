import { createClient } from "@/lib/supabase/server";
import AppointmentsManager, {
  type AdminAppointment,
} from "@/app/components/admin/AppointmentsManager";

type Row = {
  id: string;
  date_time: string;
  status: string;
  notes: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
  appointment_types: { type_name: string } | null;
  order_details:
    | {
        items: { name: string } | null;
        orders: { reference_code: string } | null;
      }
    | null;
};

export default async function AdminAppointmentsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, date_time, status, notes, profiles!appointments_user_id_fkey(full_name, email, phone_number), appointment_types(type_name), order_details(items(name), orders(reference_code))",
    )
    .order("date_time", { ascending: false })
    .limit(100);

  const appointments: AdminAppointment[] = ((data ?? []) as unknown as Row[]).map(
    (row) => ({
      id: row.id,
      dateTime: row.date_time,
      status: row.status,
      notes: row.notes,
      customerName: row.profiles?.full_name ?? null,
      customerEmail: row.profiles?.email ?? null,
      customerPhone: row.profiles?.phone_number ?? null,
      typeName: row.appointment_types?.type_name ?? "Consulta",
      itemName: row.order_details?.items?.name ?? null,
      referenceCode: row.order_details?.orders?.reference_code ?? null,
    }),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-leaf">Agenda</p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-extrabold leading-tight text-ink">
          Citas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Confirma las solicitudes, marca las consultas completadas y libera el
          horario si un paciente cancela. Solo aparecen citas respaldadas por un
          plan pagado.
        </p>
      </header>

      <AppointmentsManager appointments={appointments} />
    </div>
  );
}
