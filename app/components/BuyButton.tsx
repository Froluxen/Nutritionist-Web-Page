"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { createOrder } from "@/app/actions/orders";
import { mapDbError } from "@/lib/auth-errors";

export default function BuyButton({
  itemId,
  signedIn,
  label = "Comprar",
  tone = "ink",
}: {
  itemId: string;
  signedIn: boolean;
  label?: string;
  tone?: "ink" | "lime";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link
        href="/auth/register"
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
      >
        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        Crear cuenta para comprar
      </Link>
    );
  }

  const base =
    tone === "lime"
      ? "bg-lime text-ink hover:bg-white"
      : "bg-ink text-paper hover:bg-leaf-deep";

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const { orderId } = await createOrder(itemId);
              router.push(`/pagar/${orderId}`);
            } catch (e) {
              setError(mapDbError(e instanceof Error ? e.message : ""));
            }
          })
        }
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${base}`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        )}
        {pending ? "Creando orden…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
