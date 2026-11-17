import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPaymentSettings } from "@/lib/settings";
import {
  ORDER_STATUS_LABEL,
  formatPrice,
  orderStatusClass,
} from "@/lib/types";
import CopyButton from "@/app/components/CopyButton";
import PaymentProofForm from "@/app/components/PaymentProofForm";
import QrImage from "@/app/components/QrImage";
import CancelOrderButton from "@/app/components/CancelOrderButton";

type OrderDetailRow = {
  id: string;
  paid_price: number;
  item_id: string;
  items: {
    name: string;
    description: string | null;
    item_type: "plan" | "ebook";
    plans: { plan_duration_days: number | null; plan_type: string | null } | null;
    ebooks: { file_path: string | null } | null;
  } | null;
};

type ProofRow = {
  id: string;
  uploaded_at: string;
  reviewed_at: string | null;
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, total_paid, reference_code, created_at, paid_at, cancelled_at, cancelled_by, cancellation_reason, order_details(id, paid_price, item_id, items(name, description, item_type, plans(plan_duration_days, plan_type), ebooks(file_path))), payment_proofs(id, uploaded_at, reviewed_at)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) notFound();

  const settings = await getPaymentSettings();

  const details = ((order.order_details ?? []) as unknown as OrderDetailRow[]) ?? [];
  const proofs = ((order.payment_proofs ?? []) as unknown as ProofRow[]) ?? [];
  const unreviewedProof = proofs.some((p) => !p.reviewed_at);
  const total = Number(order.total_paid);
  const pending = order.status === "pending";
  const paid = order.status === "paid";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tracking-[-0.04em]">
              NutriWeb
            </span>
            <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-mint/60 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Mi panel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[clamp(2rem,4.4vw,3rem)] font-extrabold leading-tight text-ink">
            {paid
              ? "Pago confirmado"
              : pending
                ? "Completa tu pago"
                : "Orden cancelada"}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusClass(order.status)}`}
          >
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <p className="mt-2 max-w-2xl text-muted">
          {paid
            ? "Ya verificamos tu pago. Tus descargas están disponibles aquí y en tu panel."
            : pending
              ? "Transfiere el importe exacto con el código de referencia en la glosa y luego sube tu comprobante."
              : "Esta orden fue cancelada. Si fue un error, escríbenos o genera una nueva compra."}
        </p>

        {paid && (
          <div className="mt-6 flex items-start gap-3 rounded-3xl border border-leaf/25 bg-mint p-5">
            <BadgeCheck
              className="mt-0.5 h-6 w-6 shrink-0 text-leaf-deep"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-leaf-deep">Pago verificado</p>
              <p className="mt-1 text-sm text-leaf-deep/80">
                Confirmado el{" "}
                {order.paid_at
                  ? new Date(order.paid_at).toLocaleString("es-BO", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : "—"}
                .
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="space-y-5">
            {pending && (
              <>
                <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-lime">
                      1
                    </span>
                    <h2 className="font-display text-xl font-bold text-ink">
                      Paga con QR
                    </h2>
                  </div>

                  <div className="mt-5 grid gap-6 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-start">
                    <div>
                      {settings.qrUrl ? (
                        <QrImage src={settings.qrUrl} />
                      ) : (
                        <div className="mx-auto flex aspect-square w-full max-w-52 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper/60 p-4 text-center">
                          <QrCode className="h-10 w-10 text-muted/50" aria-hidden="true" />
                          <p className="mt-2 text-xs text-muted">
                            QR no configurado todavía. Escríbenos y te enviamos los
                            datos de pago.
                          </p>
                        </div>
                      )}
                      <p className="mt-2 text-center text-xs text-muted">
                        Escanéalo desde tu app bancaria.
                      </p>
                    </div>

                    <div className="space-y-3 text-sm">
                      {settings.bankName && (
                        <p className="flex items-center gap-2 text-muted">
                          <Banknote
                            className="h-4 w-4 text-leaf"
                            aria-hidden="true"
                          />
                          {settings.bankName}
                        </p>
                      )}
                      {settings.accountHolder && (
                        <p className="text-muted">
                          Titular:{" "}
                          <strong className="text-ink">
                            {settings.accountHolder}
                          </strong>
                        </p>
                      )}
                      {settings.accountNumber && (
                        <p className="text-muted">
                          Cuenta:{" "}
                          <strong className="font-mono text-ink">
                            {settings.accountNumber}
                          </strong>
                        </p>
                      )}

                      <div className="rounded-2xl bg-paper p-4">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
                          Importe exacto
                        </p>
                        <p className="mt-1 font-display text-3xl font-extrabold text-ink">
                          {formatPrice(total)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-leaf/25 bg-mint/60 p-4">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-leaf-deep">
                          Código de referencia (glosa)
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-xl font-bold tracking-wider text-ink">
                            {order.reference_code}
                          </p>
                          <CopyButton
                            value={order.reference_code}
                            label="código de referencia"
                          />
                        </div>
                        <p className="mt-2 text-xs text-leaf-deep/80">
                          Escríbelo en la descripción de la transferencia para que
                          podamos identificar tu pago.
                        </p>
                      </div>

                      {settings.paymentNote && (
                        <p className="rounded-2xl border border-line bg-paper/60 p-3.5 text-xs leading-relaxed text-muted">
                          {settings.paymentNote}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-lime">
                      2
                    </span>
                    <h2 className="font-display text-xl font-bold text-ink">
                      Sube tu comprobante
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Una foto legible o el PDF que te entrega el banco. Lo revisamos
                    y confirmamos tu pago manualmente.
                  </p>
                  <div className="mt-5">
                    <PaymentProofForm
                      orderId={order.id}
                      amount={total}
                      hasProof={unreviewedProof}
                    />
                  </div>
                </section>
              </>
            )}

            {paid && (
              <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-leaf-deep">
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-xl font-bold text-ink">
                    Tus descargas
                  </h2>
                </div>

                <ul className="mt-4 space-y-3">
                  {details.map((d) => {
                    const item = d.items;
                    const isEbook = item?.item_type === "ebook";
                    const hasFile = !!item?.ebooks?.file_path;

                    return (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper/50 p-4"
                      >
                        <div>
                          <p className="font-medium text-ink">
                            {item?.name ?? "Producto"}
                          </p>
                          <p className="text-xs text-muted">
                            {isEbook ? "eBook (PDF)" : "Plan de alimentación"}
                          </p>
                        </div>
                        {isEbook && hasFile ? (
                          <a
                            href={`/downloads/${d.item_id}`}
                            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Descargar PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted">
                            {isEbook
                              ? "Archivo pendiente de subida"
                              : "Incluye agenda de cita"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {order.status === "cancelled" && (
              <section className="rounded-3xl border border-line bg-sheet p-5 text-sm text-muted sm:p-7">
                <p className="font-medium text-ink">
                  {order.cancelled_by === user.id
                    ? "Cancelaste esta orden."
                    : "La nutricionista rechazó esta orden."}
                </p>
                {order.cancellation_reason && (
                  <p className="mt-2 rounded-2xl bg-paper px-3.5 py-2.5 text-xs">
                    Motivo: {order.cancellation_reason}
                  </p>
                )}
                {order.cancelled_at && (
                  <p className="mt-2 text-xs">
                    {new Date(order.cancelled_at).toLocaleString("es-BO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                <p className="mt-3">
                  Las órdenes canceladas no permiten agendar citas ni descargar
                  eBooks. Puedes volver al catálogo y generar una compra nueva.
                </p>
                <Link
                  href="/"
                  className="mt-4 inline-flex rounded-full border border-line px-4 py-2 font-medium text-ink transition hover:bg-paper"
                >
                  Volver al catálogo
                </Link>
              </section>
            )}
          </div>

          <aside className="rounded-3xl border border-line bg-sheet p-6 lg:sticky lg:top-6">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-leaf" aria-hidden="true" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Resumen de la orden
              </h2>
            </div>

            <ul className="mt-4 space-y-3">
              {details.map((d) => (
                <li key={d.id} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-ink/80">{d.items?.name ?? "Producto"}</span>
                    <span className="whitespace-nowrap font-medium text-ink">
                      {formatPrice(Number(d.paid_price))}
                    </span>
                  </div>
                  {d.items?.item_type === "plan" &&
                    d.items.plans?.plan_duration_days && (
                      <p className="mt-0.5 text-xs text-muted">
                        {d.items.plans.plan_duration_days} días
                        {d.items.plans.plan_type
                          ? ` · ${d.items.plans.plan_type}`
                          : ""}
                      </p>
                    )}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm font-medium text-muted">Total</span>
              <span className="font-display text-2xl font-extrabold text-ink">
                {formatPrice(total)}
              </span>
            </div>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-muted">
              <div className="flex items-center justify-between gap-2">
                <dt>Código</dt>
                <dd className="font-mono font-semibold text-ink">
                  {order.reference_code}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Creada</dt>
                <dd>
                  {new Date(order.created_at).toLocaleDateString("es-BO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Comprobantes</dt>
                <dd>{proofs.length}</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2">
              {pending && (
                <p className="flex items-start gap-2 rounded-2xl bg-paper p-3 text-xs text-muted">
                  <Clock3
                    className="mt-0.5 h-4 w-4 shrink-0 text-leaf"
                    aria-hidden="true"
                  />
                  Revisamos los pagos de lunes a sábado. Tu orden pasa a{" "}
                  <strong className="text-ink">pagado</strong> cuando confirmamos la
                  transferencia.
                </p>
              )}
              <p className="flex items-start gap-2 text-xs text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
                Tus comprobantes se guardan en un repositorio privado.
              </p>
            </div>

            {pending && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs text-muted">
                  ¿Ya no quieres continuar con esta compra?
                </p>
                <CancelOrderButton
                  orderId={order.id}
                  className="[&>button]:w-full [&>button]:justify-center"
                />
              </div>
            )}
          </aside>
        </div>

        {paid && (
          <p className="mt-8 flex items-center gap-2 text-sm text-leaf-deep">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Puedes volver a esta página desde tu panel cuando necesites descargar de
            nuevo.
          </p>
        )}

        {pending && (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted">
            <Upload className="h-4 w-4" aria-hidden="true" />
            ¿Problemas con la subida? Escríbenos indicando tu código{" "}
            <span className="font-mono font-semibold text-ink">
              {order.reference_code}
            </span>
            .
          </p>
        )}
      </div>
    </main>
  );
}
