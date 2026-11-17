"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type HeaderProps = {
  user: {
    email: string;
    fullName: string | null;
  } | null;
};

const links = [
  { href: "#planes", label: "Planes" },
  { href: "#ebooks", label: "eBooks" },
  { href: "#agendar", label: "Citas" },
  { href: "#nutricionista", label: "Nutricionista" },
];

function getInitials(fullName: string | null, email: string) {
  if (fullName) {
    return fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }
  return email.charAt(0).toUpperCase();
}

export default function Header({ user }: HeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-bold tracking-[-0.04em] text-ink">
            NutriWeb
          </span>
          <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-mint/70 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 rounded-full border border-line bg-sheet py-1.5 pl-1.5 pr-4 transition hover:border-leaf/40"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-lime">
                {getInitials(user.fullName, user.email)}
              </span>
              <span className="max-w-[10rem] truncate text-sm font-medium text-ink">
                {user.fullName ?? user.email}
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-ink transition hover:bg-mint/70"
              >
                Ingresar
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-soft"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-movil"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-sheet text-ink md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div
          id="menu-movil"
          className="border-t border-line bg-paper px-5 pb-6 pt-3 md:hidden"
        >
          <div className="flex flex-col">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 py-3 text-base font-medium text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-paper"
              >
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-paper"
                >
                  Crear cuenta
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-line px-5 py-3 text-center text-sm font-semibold text-ink"
                >
                  Ingresar
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
