export type Profile = {
  id: string;
  role: "admin" | "patient";
  full_name: string;
  email: string;
};

export type CatalogPlan = {
  itemId: string;
  planId: string;
  name: string;
  description: string | null;
  price: number;
  planType: string | null;
  durationDays: number | null;
};

export type CatalogEbook = {
  itemId: string;
  name: string;
  description: string | null;
  price: number;
  author: string | null;
  /** Ruta del PDF dentro del bucket privado `ebooks` (no es una URL pública). */
  filePath: string | null;
};

export type Purchase = {
  detailId: string;
  orderId: string;
  itemId: string;
  itemName: string;
  paidPrice: number;
  status: string;
};

export type AppointmentType = {
  id: string;
  typeName: string;
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de pago",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
};

export function appointmentStatusClass(status: string): string {
  if (status === "confirmed") return "bg-mint text-leaf-deep";
  if (status === "completed") return "bg-ink text-paper";
  if (status === "cancelled") return "bg-line/70 text-muted";
  return "bg-lime/60 text-ink";
}

export function orderStatusClass(status: string): string {
  if (status === "paid") return "bg-mint text-leaf-deep";
  if (status === "cancelled") return "bg-line/70 text-muted";
  return "bg-lime/60 text-ink";
}

export function formatPrice(value: number | string | null): string {
  if (value === null || value === undefined) return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return `$${n.toFixed(2)}`;
}
