import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 text-ink">
      <div className="w-full max-w-md rounded-3xl border border-line bg-sheet p-8 text-center shadow-soft">
        <p className="font-display text-6xl font-extrabold tracking-tight text-leaf">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">
          Esta página no existe
        </h1>
        <p className="mt-2 text-sm text-muted">
          Puede que el enlace haya cambiado o que el contenido ya no esté
          disponible.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
