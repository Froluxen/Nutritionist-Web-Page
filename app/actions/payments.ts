"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/auth-errors";

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

function revalidateAll(orderId?: string) {
  revalidatePath("/dashboard/admin/pagos");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
  if (orderId) revalidatePath(`/pagar/${orderId}`);
}

/** Confirma el pago de una orden pendiente (RPC `confirm_payment`). */
export async function confirmPaymentAction(orderId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("confirm_payment", {
    p_order_id: orderId,
  });
  if (error) throw new Error(mapDbError(error.message));
  revalidateAll(orderId);
}

/** Rechaza/cancela una orden pendiente con la RPC `cancel_order`. */
export async function cancelOrderAction(orderId: string, reason?: string | null) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason?.trim().slice(0, 300) || null,
  });

  if (error) throw new Error(mapDbError(error.message));
  revalidateAll(orderId);
}
