/**
 * Datos del cobro por QR bancario.
 *
 * v1 usa un QR fijo del banco (sin API): el cliente escanea, transfiere el
 * importe exacto y escribe el `reference_code` de la orden en la glosa.
 * Configura estos valores en `.env.local` (y en Vercel) cuando tengas el QR.
 */
export const paymentConfig = {
  /** Ruta local (ej. `/qr-pago.png`) o URL pública de la imagen del QR. */
  qrUrl: process.env.NEXT_PUBLIC_PAYMENT_QR_URL || null,
  bankName: process.env.NEXT_PUBLIC_PAYMENT_BANK_NAME || null,
  accountHolder: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_HOLDER || null,
  accountNumber: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER || null,
};

/** Límite de subida del comprobante (debe coincidir con el bucket). */
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export const PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
