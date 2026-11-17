import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PaymentsQueue, {
  type QueueOrder,
} from "@/app/components/admin/PaymentsQueue";
import { formatPrice } from "@/lib/types";

type PendingRow = {
  id: string;
  reference_code: string;
  total_paid: number;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
  order_details: { items: { name: string } | null }[] | null;
  payment_proofs:
    | {
        id: string;
        storage_path: string;
        amount_declared: number;
        note: string | null;
        uploaded_at: string;
      }[]
    | null;
};

type PaidRow = {
  id: string;
  reference_code: string;
  total_paid: number;
  paid_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  order_details: { items: { name: string } | null }[] | null;
};

type CancelledRow = {
  id: string;
  reference_code: string;
  total_paid: number;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  order_details: { items: { name: string } | null }[] | null;
};

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const { data: pendingData } = await supabase
    .from("orders")
    .select(
      "id, reference_code, total_paid, created_at, profiles!orders_user_id_fkey(full_name, email, phone_number), order_details(items(name)), payment_proofs(id, storage_path, amount_declared, note, uploaded_at)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: paidData } = await supabase
    .from("orders")
    .select(
      "id, reference_code, total_paid, paid_at, profiles!orders_user_id_fkey(full_name, email), order_details(items(name))",
    )
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(10);

  const { data: cancelledData } = await supabase
    .from("orders")
    .select(
      "id, reference_code, total_paid, cancelled_at, cancelled_by, cancellation_reason, profiles!orders_user_id_fkey(full_name, email), order_details(items(name))",
    )
    .eq("status", "cancelled")
    .order("cancelled_at", { ascending: false })
    .limit(10);

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const pending = (pendingData ?? []) as unknown as PendingRow[];
  const paid = (paidData ?? []) as unknown as PaidRow[];
  const cancelled = (cancelledData ?? []) as unknown as CancelledRow[];

  // Enlaces firmados temporales para los comprobantes (bucket privado).
  const proofs = pending.flatMap((o) => o.payment_proofs ?? []);
  const signed = new Map<string, string | null>();
  await Promise.all(
    proofs.map(async (proof) => {
      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(proof.storage_path, 3600);
      signed.set(proof.id, data?.signedUrl ?? null);
    }),
  );

  const queue: QueueOrder[] = pending.map((o) => ({
    id: o.id,
    referenceCode: o.reference_code,
    total: Number(o.total_paid),
    createdAt: o.created_at,
    customerName: o.profiles?.full_name ?? null,
    customerEmail: o.profiles?.email ?? null,
    customerPhone: o.profiles?.phone_number ?? null,
    items: (o.order_details ?? []).map((d) => d.items?.name ?? "Producto"),
    proofs: (o.payment_proofs ?? []).map((p) => ({
      id: p.id,
      path: p.storage_path,
      amount: Number(p.amount_declared),
      note: p.note,
      uploadedAt: p.uploaded_at,
      url: signed.get(p.id) ?? null,
      isPdf: p.storage_path.toLowerCase().endsWith(".pdf"),
    })),
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-leaf">Cobros</p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-extrabold leading-tight text-ink">
          Pagos por revisar
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Contrasta el comprobante y el código con tu app bancaria antes de
          confirmar. Al confirmar se habilitan las descargas y la agenda de citas
          del cliente.
        </p>
      </header>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-leaf" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Cola de pagos ({queue.length})
          </h2>
        </div>
        <PaymentsQueue orders={queue} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-leaf" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Últimos pagos confirmados
          </h2>
        </div>

        {paid.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-sheet p-6 text-sm text-muted">
            Todavía no confirmaste ningún pago.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-sheet">
            {paid.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    <span className="font-mono">{o.reference_code}</span> ·{" "}
                    {o.profiles?.full_name ?? o.profiles?.email ?? "Cliente"}
                  </p>
                  <p className="text-xs text-muted">
                    {(o.order_details ?? [])
                      .map((d) => d.items?.name ?? "Producto")
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatPrice(Number(o.total_paid))}
                  </p>
                  <p className="text-xs text-muted">
                    {o.paid_at
                      ? new Date(o.paid_at).toLocaleString("es-BO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-muted" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Rechazos y cancelaciones recientes
          </h2>
        </div>

        {cancelled.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-sheet p-6 text-sm text-muted">
            Todavía no hay órdenes canceladas.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-sheet">
            {cancelled.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    <span className="font-mono">{o.reference_code}</span> ·{" "}
                    {o.profiles?.full_name ?? o.profiles?.email ?? "Cliente"}
                  </p>
                  <p className="text-xs text-muted">
                    {(o.order_details ?? [])
                      .map((d) => d.items?.name ?? "Producto")
                      .join(" · ")}
                  </p>
                  {o.cancellation_reason && (
                    <p className="mt-1 text-xs italic text-muted">
                      Motivo: {o.cancellation_reason}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatPrice(Number(o.total_paid))}
                  </p>
                  <p className="text-xs text-muted">
                    {o.cancelled_at
                      ? new Date(o.cancelled_at).toLocaleString("es-BO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-line/60 px-2 py-0.5 text-[0.65rem] font-semibold text-muted">
                    {o.cancelled_by === currentUser?.id
                      ? "Rechazada por ti"
                      : "Cancelada por el cliente"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
