"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { cancelOrder } from "@/app/actions/orders";

export default function CancelOrderButton({
  orderId,
  label = "Cancelar orden",
  className,
}: {
  orderId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !window.confirm(
        "¿Cancelar esta orden? No se podrá pagar ni usar para agendar. Podrás crear una nueva cuando quieras.",
      )
    ) {
      return;
    }

    setError(null);
    start(async () => {
      const result = await cancelOrder(orderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {pending ? "Cancelando…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
