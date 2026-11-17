"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/auth-errors";

const fieldClass =
  "w-full rounded-xl border border-line bg-paper/50 px-3.5 py-3 text-sm text-ink placeholder:text-muted/50 focus:border-leaf focus:bg-sheet focus:outline-none focus:ring-2 focus:ring-leaf/20";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-muted";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(mapAuthError(error.message));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen bg-paper text-ink lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper lg:flex xl:p-14">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-bold tracking-[-0.04em]">
            NutriWeb
          </span>
          <span className="h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
        </Link>

        <div
          className="pointer-events-none absolute -right-28 top-24 h-80 w-80 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-44 h-56 w-56 rounded-full bg-leaf/30 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-paper/70">
            <Sparkles className="h-3.5 w-3.5 text-lime" aria-hidden="true" />
            Nutrición que se adapta a ti
          </span>
          <h2 className="mt-6 font-display text-[clamp(2.2rem,3.6vw,3.2rem)] font-extrabold leading-[1.02]">
            Comer mejor empieza con una conversación.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-paper/70">
            {[
              "Planes personalizados según tu rutina",
              "Seguimiento real, sin dietas imposibles",
              "eBooks y consultas en un mismo lugar",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime text-ink">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-paper/40">
          Nutrición clínica · Atención online y presencial
        </p>
      </aside>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>

          <div className="mt-8 flex items-baseline gap-1.5 lg:hidden">
            <span className="font-display text-xl font-bold tracking-[-0.04em]">
              NutriWeb
            </span>
            <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
          </div>

          <h1 className="mt-6 font-display text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold leading-tight text-ink">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-muted">
            Ingresa para revisar tus compras, descargas y citas.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            ¿No tienes cuenta?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
