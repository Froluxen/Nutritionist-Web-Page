"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/auth-errors";

export type AppointmentActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    throw new Error("No tienes permiso para esa acción.");
  }

  return supabase;
}

function revalidateAppointments() {
  revalidatePath("/dashboard/admin/citas");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

/** Confirma o marca como completada una cita (solo admin). */
export async function setAppointmentStatusAction(
  appointmentId: string,
  status: "confirmed" | "completed",
): Promise<AppointmentActionResult> {
  try {
    if (status !== "confirmed" && status !== "completed") {
      return { ok: false, error: "Estado no permitido." };
    }

    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointmentId);

    if (error) return { ok: false, error: mapDbError(error.message) };

    revalidateAppointments();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo actualizar la cita.",
    };
  }
}

/** Cancela una cita con la RPC (dueño o admin). */
export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<AppointmentActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.rpc("cancel_appointment", {
      p_id: appointmentId,
    });

    if (error) return { ok: false, error: mapDbError(error.message) };

    revalidateAppointments();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo cancelar la cita.",
    };
  }
}
