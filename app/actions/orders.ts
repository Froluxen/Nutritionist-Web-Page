"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/auth-errors";

export type CreatedOrder = {
  orderId: string;
  referenceCode: string;
};

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

/**
 * Crea la orden en el servidor mediante la RPC `create_order`:
 * - el precio se lee de `items` (nunca llega del cliente)
 * - orden + detalle se insertan en una sola transacción
 * - se genera el `reference_code` para la glosa del QR
 */
export async function createOrder(itemId: string): Promise<CreatedOrder> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión para comprar.");

  const { data, error } = await supabase.rpc("create_order", {
    p_item_id: itemId,
  });
  if (error) throw new Error(mapDbError(error.message));

  const order = Array.isArray(data) ? data[0] : data;
  if (!order?.id) throw new Error("No se pudo crear la orden.");

  revalidatePath("/dashboard");
  return { orderId: order.id, referenceCode: order.reference_code };
}

/**
 * Cancela una orden pendiente propia (o cualquiera si eres admin).
 * La RPC `cancel_order` valida propiedad/rol y guarda motivo y autor.
 */
export async function cancelOrder(
  orderId: string,
  reason?: string | null,
): Promise<CancelOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };

  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason?.trim().slice(0, 300) || null,
  });

  if (error) return { ok: false, error: mapDbError(error.message) };

  revalidatePath("/dashboard");
  revalidatePath(`/pagar/${orderId}`);
  revalidatePath("/dashboard/admin/pagos");
  revalidatePath("/dashboard/admin");
  return { ok: true };
}
