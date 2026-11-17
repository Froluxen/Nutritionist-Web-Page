"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Phone,
  XCircle,
} from "lucide-react";
import {
  cancelOrderAction,
  confirmPaymentAction,
} from "@/app/actions/payments";
import { formatPrice } from "@/lib/types";

export type QueueProof = {
  id: string;
  url: string | null;
  path: string;
  amount: number;
  note: string | null;
  uploadedAt: string;
  isPdf: boolean;
};

export type QueueOrder = {
  id: string;
  referenceCode: string;
  total: number;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  items: string[];
  proofs: QueueProof[];
};

export default function PaymentsQueue({ orders }: { orders: QueueOrder[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ id: string; action: "confirm" | "cancel" } | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function run(order: QueueOrder, action: "confirm" | "cancel") {
    let reason: string | null = null;

    if (action === "confirm") {
      if (
        !window.confirm(
          `¿Confirmar que recibiste ${formatPrice(order.total)} para la orden ${order.referenceCode}?`,
        )
      ) {
        return;
      }
    } else {
      const input = window.prompt(
        `Motivo del rechazo para ${order.referenceCode} (opcional). Acepta para cancelar la orden:`,
        "",
      );
      if (input === null) return;
      reason = input.trim().slice(0, 300) || null;
    }

    setBusy({ id: order.id, action });
    setErrors((prev) => ({ ...prev, [order.id]: "" }));

    try {
      if (action === "confirm") await confirmPaymentAction(order.id);
      else await cancelOrderAction(order.id, reason);
      router.refresh();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [order.id]:
          e instanceof Error ? e.message : "No se pudo completar la acción.",
      }));
    } finally {
      setBusy(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-sheet p-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint">
          <CheckCircle2 className="h-6 w-6 text-leaf" aria-hidden="true" />
        </span>
        <p className="mt-3 font-display text-lg font-bold text-ink">
          No hay pagos pendientes de revisión
        </p>
        <p className="mt-1 text-sm text-muted">
          Cuando un cliente suba su comprobante, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => {
        const isBusy = busy?.id === order.id;
        return (
          <li
            key={order.id}
            className="rounded-3xl border border-line bg-sheet p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">
                    {order.referenceCode}
                  </span>
                  <span className="rounded-full bg-lime/60 px-2.5 py-0.5 text-xs font-semibold text-ink">
                    Pendiente
                  </span>
                  {order.proofs.length === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      Sin comprobante
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-lg font-bold text-ink">
                  {order.customerName ?? "Cliente"}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {order.customerEmail ?? "—"}
                  {order.customerPhone && (
                    <>
                      <Phone className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                      {order.customerPhone}
                    </>
                  )}
                </p>
                <p className="mt-2 text-sm text-ink/80">{order.items.join(" · ")}</p>
                <p className="mt-1 text-xs text-muted">
                  Creada el{" "}
                  {new Date(order.createdAt).toLocaleString("es-BO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              <div className="rounded-2xl bg-paper px-4 py-3 text-right">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
                  Importe
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold text-ink">
                  {formatPrice(order.total)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              {order.proofs.length === 0 ? (
                <p className="text-sm text-muted sm:col-span-2">
                  El cliente aún no subió comprobante. Verifica el movimiento en tu
                  app bancaria por el código{" "}
                  <span className="font-mono font-semibold text-ink">
                    {order.referenceCode}
                  </span>
                  .
                </p>
              ) : (
                order.proofs.map((proof) => (
                  <div
                    key={proof.id}
                    className="rounded-2xl border border-line bg-paper/50 p-3"
                  >
                    {proof.url && !proof.isPdf ? (
                      <a href={proof.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proof.url}
                          alt={`Comprobante de ${order.referenceCode}`}
                          className="h-44 w-full rounded-xl bg-sheet object-contain"
                        />
                      </a>
                    ) : proof.url ? (
                      <a
                        href={proof.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl bg-sheet text-sm font-medium text-muted transition hover:text-leaf-deep"
                      >
                        <FileText className="h-8 w-8" aria-hidden="true" />
                        Abrir PDF
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <p className="flex h-44 items-center justify-center rounded-xl bg-sheet p-3 text-center text-xs text-muted">
                        No se pudo generar el enlace del archivo.
                      </p>
                    )}

                    <p className="mt-2 text-xs text-muted">
                      Declarado:{" "}
                      <strong className="text-ink">{formatPrice(proof.amount)}</strong>{" "}
                      ·{" "}
                      {new Date(proof.uploadedAt).toLocaleString("es-BO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                    {proof.note && (
                      <p className="mt-1 text-xs italic text-muted">“{proof.note}”</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {errors[order.id] && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {errors[order.id]}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => run(order, "confirm")}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:opacity-60"
              >
                {isBusy && busy?.action === "confirm" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                Confirmar pago
              </button>
              <button
                type="button"
                onClick={() => run(order, "cancel")}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
              >
                {isBusy && busy?.action === "cancel" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                )}
                Rechazar pago
              </button>
            </div>

            <p className="mt-2 text-xs text-muted">
              Al rechazar, la orden queda cancelada y el motivo se guarda en el
              historial del cliente.
            </p>
          </li>
        );
      })}
    </ul>
  );
}
