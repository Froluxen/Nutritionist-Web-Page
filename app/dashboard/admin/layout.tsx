import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import AdminNav from "@/app/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: LayoutProps<"/dashboard/admin">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { count: pendingPayments } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen max-w-[86rem] flex-col lg:flex-row">
        <aside className="flex flex-col gap-6 bg-ink px-5 py-5 text-paper lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:justify-between lg:px-5 lg:py-7">
          <div>
            <Link href="/" className="flex items-baseline gap-1.5 px-2">
              <span className="font-display text-xl font-bold tracking-[-0.04em]">
                NutriWeb
              </span>
              <span className="h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
            </Link>
            <p className="mt-1 px-2 text-[0.7rem] uppercase tracking-[0.18em] text-paper/40">
              Administración
            </p>

            <div className="mt-7">
              <AdminNav pendingPayments={pendingPayments ?? 0} />
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="hidden px-2 text-xs text-paper/40 lg:block">
              {profile?.full_name ?? user.email}
            </p>
            <div className="flex gap-2 lg:mt-3 lg:flex-col lg:gap-1">
              <Link
                href="/dashboard"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-paper/70 transition hover:bg-white/10 hover:text-paper lg:flex-none lg:justify-start"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                Mi panel
              </Link>
              <form action={signOut} className="flex flex-1 lg:flex-none">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-paper/70 transition hover:bg-white/10 hover:text-paper lg:justify-start"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
