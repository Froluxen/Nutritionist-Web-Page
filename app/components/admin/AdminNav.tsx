"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Package,
  SlidersHorizontal,
} from "lucide-react";

const links = [
  { href: "/dashboard/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/dashboard/admin/catalogo", label: "Catálogo", icon: Package },
  { href: "/dashboard/admin/citas", label: "Citas", icon: CalendarDays },
  { href: "/dashboard/admin/ajustes", label: "Ajustes", icon: SlidersHorizontal },
];

export default function AdminNav({ pendingPayments }: { pendingPayments: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de administración">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors lg:rounded-xl ${
                  active
                    ? "bg-lime text-ink"
                    : "text-paper/70 hover:bg-white/10 hover:text-paper"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
                {href === "/dashboard/admin/pagos" && pendingPayments > 0 && (
                  <span
                    className={`ml-auto hidden min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold lg:inline ${
                      active ? "bg-ink text-lime" : "bg-lime text-ink"
                    }`}
                  >
                    {pendingPayments}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
