import { createClient } from "@/lib/supabase/server";
import { paymentConfig } from "@/lib/payment";

export type PaymentSettings = {
  qrUrl: string | null;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  paymentNote: string | null;
  /** true cuando hay una imagen de QR disponible para mostrar. */
  configured: boolean;
  /** false si la tabla `settings` todavía no existe (migración v3 pendiente). */
  tableReady: boolean;
};

const fallback = (): PaymentSettings => ({
  qrUrl: paymentConfig.qrUrl,
  bankName: paymentConfig.bankName,
  accountHolder: paymentConfig.accountHolder,
  accountNumber: paymentConfig.accountNumber,
  paymentNote: null,
  configured: !!paymentConfig.qrUrl,
  tableReady: false,
});

/**
 * Datos de cobro guardados por el admin (tabla `settings`) con respaldo en
 * variables de entorno si la tabla aún no está creada.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("qr_path, bank_name, account_holder, account_number, payment_note")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) return fallback();

  const qrUrl = data.qr_path
    ? supabase.storage.from("assets").getPublicUrl(data.qr_path).data.publicUrl
    : paymentConfig.qrUrl;

  return {
    qrUrl,
    bankName: data.bank_name || paymentConfig.bankName,
    accountHolder: data.account_holder || paymentConfig.accountHolder,
    accountNumber: data.account_number || paymentConfig.accountNumber,
    paymentNote: data.payment_note || null,
    configured: !!qrUrl,
    tableReady: true,
  };
}
