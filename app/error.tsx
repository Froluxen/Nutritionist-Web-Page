"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 text-ink">
      <div className="w-full max-w-md rounded-3xl border border-line bg-sheet p-8 text-center shadow-soft">
        <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-leaf">
          Algo se quemó en la cocina
        </p>
        <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink">
          No pudimos cargar esta página
        </h1>
        <p className="mt-3 text-sm text-muted">
          {error.message || "Ocurrió un error inesperado. Inténtalo de nuevo."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint/40"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
