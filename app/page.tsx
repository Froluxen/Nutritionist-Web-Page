import {
  ArrowDownRight,
  BookOpen,
  CalendarCheck,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Header from "@/app/components/Header";
import AppointmentForm from "@/app/components/AppointmentForm";
import BuyButton from "@/app/components/BuyButton";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/types";

function HeroPlate() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative aspect-square">
        <div className="absolute inset-0 rounded-full bg-mint" aria-hidden="true" />
        <div
          className="absolute inset-[7%] rounded-full border border-leaf/25"
          aria-hidden="true"
        />
        <div className="absolute inset-[18%] rounded-full bg-ink" aria-hidden="true" />

        {/* Media luna de acento */}
        <div
          className="absolute inset-[18%] overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div className="absolute -right-[18%] -top-[18%] h-[70%] w-[70%] rounded-full bg-leaf/40 blur-[2px]" />
          <div className="absolute bottom-[12%] left-[14%] h-3 w-24 rounded-full bg-lime/80" />
        </div>

        <div
          className="absolute -right-1 top-[12%] flex h-20 w-20 items-center justify-center rounded-full bg-lime text-ink shadow-lift"
          aria-hidden="true"
        >
          <Sparkles className="h-8 w-8" />
        </div>

        <div className="absolute -bottom-2 -left-2 w-56 rounded-3xl border border-line bg-sheet p-5 shadow-lift sm:-left-6">
          <p className="text-xs font-medium text-muted">Plan de 30 días</p>
          <p className="mt-1 font-display text-xl font-bold leading-tight text-ink">
            Hecho para tu rutina
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-leaf">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Seguimiento incluido
          </div>
        </div>

        <div className="absolute -top-3 left-2 rounded-full border border-line bg-sheet px-4 py-2 text-xs font-semibold text-ink shadow-soft sm:left-6">
          Sin dietas imposibles
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    fullName = profile?.full_name ?? null;
  }

  const { data: ebookRows } = await supabase
    .from("items")
    .select("id, name, description, price, ebooks(author, file_path)")
    .eq("item_type", "ebook")
    .eq("status", true)
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: planRows } = await supabase
    .from("items")
    .select("id, name, description, price, plans(id, plan_type, plan_duration_days)")
    .eq("item_type", "plan")
    .eq("status", true)
    .order("created_at", { ascending: true })
    .limit(12);

  const { data: typeRows } = await supabase
    .from("appointment_types")
    .select("id, type_name")
    .eq("is_active", true)
    .limit(10);

  let purchases: { detailId: string; itemName: string }[] = [];
  if (user) {
    // Solo compras de PLAN pagadas habilitan una cita.
    const { data: details } = await supabase
      .from("order_details")
      .select("id, items(name, item_type), orders!inner(user_id, status)")
      .eq("orders.user_id", user.id)
      .eq("orders.status", "paid")
      .limit(50);
    purchases =
      details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.filter((d) => (d.items as any)?.item_type === "plan")
        .map((d) => ({
          detailId: d.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          itemName: (d.items as any)?.name ?? "Plan",
        })) ?? [];
  }

  const ebooks =
    ebookRows?.map((r) => ({
      itemId: r.id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      author: ((r.ebooks as any)?.author ?? null) as string | null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filePath: ((r.ebooks as any)?.file_path ?? null) as string | null,
    })) ?? [];

  const plans =
    planRows?.map((p) => ({
      itemId: p.id,
      planId: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      planType: ((p.plans as any)?.plan_type ?? null) as string | null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      durationDays: ((p.plans as any)?.plan_duration_days ?? null) as number | null,
    })) ?? [];

  return (
    <main className="bg-paper text-ink">
      <Header user={user ? { email: user.email ?? "", fullName } : null} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-28 lg:pt-20">
          <div>
            <p className="reveal inline-flex items-center gap-2 rounded-full border border-line bg-sheet px-4 py-1.5 text-sm text-muted">
              <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
              Atención online y presencial
            </p>

            <h1 className="reveal delay-1 mt-6 font-display text-[clamp(2.6rem,6.4vw,4.7rem)] font-extrabold leading-[0.95] text-ink">
              Un plan que se adapta a tu vida, no al revés.
            </h1>

            <p className="reveal delay-2 mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Planes de alimentación personalizados, seguimiento real y material
              para aprender a comer mejor. Sin contar cada caloría ni empezar de
              cero cada lunes.
            </p>

            <div className="reveal delay-3 mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#planes"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
              >
                Ver planes
                <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#agendar"
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-transparent px-6 py-3.5 text-sm font-semibold text-ink transition hover:border-ink/50 hover:bg-sheet"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                Agendar mi cita
              </a>
            </div>

            <ul className="reveal delay-3 mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted">
              {[
                "Planes a tu medida",
                "Seguimiento por WhatsApp",
                "Pago seguro con QR",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-leaf" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal-plate">
            <HeroPlate />
          </div>
        </div>
      </section>

      {/* Cómo se trabaja */}
      <section className="border-y border-line bg-sheet">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          <div className="md:pr-10">
            <p className="font-display text-xl font-bold text-ink">
              Escuchamos primero
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Tu historia, tus horarios y lo que ya probaste. El plan parte de tu
              realidad, no de una plantilla.
            </p>
          </div>
          <div className="md:px-10">
            <p className="font-display text-xl font-bold text-ink">
              Ajustamos en el camino
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Revisamos cómo te sientes y qué te funciona. Un plan vivo cambia
              cuando tu semana cambia.
            </p>
          </div>
          <div className="md:pl-10">
            <p className="font-display text-xl font-bold text-ink">
              Aprendes a sostenerlo
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              eBooks y guías prácticas para que las decisiones del día a día sean
              cada vez más fáciles.
            </p>
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight text-ink">
                Planes
              </h2>
              <p className="mt-3 max-w-xl text-muted">
                Elige según el acompañamiento que necesitas. Todos se adaptan a
                tus horarios, preferencias y objetivos.
              </p>
            </div>
            <p className="text-sm text-muted">
              Cita incluida al comprar un plan
            </p>
          </div>

          {plans.length > 0 ? (
            <ul className="mt-10 border-t border-line">
              {plans.map((plan) => (
                <li
                  key={plan.itemId}
                  className="grid gap-5 border-b border-line py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="font-display text-2xl font-bold text-ink">
                        {plan.name}
                      </h3>
                      {(plan.durationDays || plan.planType) && (
                        <span className="rounded-full bg-mint px-3 py-1 text-xs font-medium text-leaf-deep">
                          {[
                            plan.durationDays ? `${plan.durationDays} días` : null,
                            plan.planType,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <span className="font-display text-3xl font-bold tracking-tight text-ink">
                      {formatPrice(plan.price)}
                    </span>
                    <BuyButton itemId={plan.itemId} signedIn={!!user} label="Comprar plan" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-line bg-sheet p-10 text-center">
              <p className="font-display text-xl font-bold text-ink">
                Los planes se están preparando
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Escríbenos y te contamos cuál se ajusta mejor a lo que buscas.
              </p>
              <a
                href="#agendar"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Quiero que me asesoren
              </a>
            </div>
          )}
        </div>
      </section>

      {/* eBooks */}
      <section id="ebooks" className="scroll-mt-24 bg-ink px-5 py-20 text-paper sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight">
                eBooks
              </h2>
              <p className="mt-3 max-w-xl text-paper/70">
                Guías cortas y directas para resolver las dudas que aparecen
                cuando estás lejos del consultorio.
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm text-paper/60">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Descarga protegida al confirmar el pago
            </p>
          </div>

          {ebooks.length > 0 ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {ebooks.map((resource) => (
                <article
                  key={resource.itemId}
                  className="group grid gap-6 rounded-3xl border border-white/10 bg-ink-soft p-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-6"
                >
                  <div className="relative flex aspect-[3/4] items-end overflow-hidden rounded-2xl bg-gradient-to-br from-leaf to-ink p-4">
                    <div
                      className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-lime/20"
                      aria-hidden="true"
                    />
                    <span className="absolute right-3 top-3 font-display text-5xl font-extrabold text-lime/30">
                      {resource.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <BookOpen className="h-6 w-6 text-lime" aria-hidden="true" />
                  </div>

                  <div className="flex flex-col">
                    <h3 className="font-display text-xl font-bold leading-tight">
                      {resource.name}
                    </h3>
                    {resource.author && (
                      <p className="mt-1 text-sm text-paper/60">
                        por {resource.author}
                      </p>
                    )}
                    {resource.description && (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-paper/70">
                        {resource.description}
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-5">
                      <span className="font-display text-2xl font-bold text-lime">
                        {formatPrice(resource.price)}
                      </span>
                      {resource.filePath ? (
                        <BuyButton
                          itemId={resource.itemId}
                          signedIn={!!user}
                          label="Comprar eBook"
                          tone="lime"
                        />
                      ) : (
                        <span className="text-sm text-paper/50">
                          Disponible próximamente
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-12 rounded-3xl border border-dashed border-white/15 p-10 text-center">
              <p className="font-display text-xl font-bold">
                Los eBooks están en camino
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-paper/60">
                Mientras tanto, un plan personalizado incluye material educativo.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Citas */}
      <section id="agendar" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          <div>
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight text-ink">
              Agenda tu cita
            </h2>
            <p className="mt-4 max-w-md text-muted">
              La consulta se agenda con un plan pagado. Así llegamos a la cita con
              un plan preparado para ti y no con preguntas sueltas.
            </p>

            <ol className="mt-8 space-y-5">
              {[
                {
                  title: "Compra tu plan",
                  text: "Paga con QR y sube tu comprobante. Te confirmamos por correo.",
                },
                {
                  title: "Elige día y hora",
                  text: "Online o presencial. Reservamos una hora completa para ti.",
                },
                {
                  title: "Llega a tu consulta",
                  text: "Revisamos tu plan, resolvemos dudas y ajustamos lo necesario.",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint font-display text-sm font-bold text-leaf-deep">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <AppointmentForm
              plans={plans}
              purchases={purchases}
              appointmentTypes={(typeRows ?? []).map((t) => ({
                id: t.id,
                typeName: t.type_name,
              }))}
            />
          </div>
        </div>
      </section>

      {/* Nutricionista */}
      <section
        id="nutricionista"
        className="scroll-mt-24 border-y border-line bg-mint px-5 py-20 sm:px-8 sm:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="text-sm font-medium text-leaf-deep">
                Quién te acompaña
              </p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.4vw,3.4rem)] font-extrabold leading-[1.02] text-ink">
                Nutrición clínica con los pies en tu cocina.
              </h2>
            </div>
            <div>
              <p className="text-lg leading-relaxed text-ink/80">
                Soy licenciada en nutrición. Trabajo con personas que quieren
                dejar de pelear con la comida: sin culpa, sin restricciones
                extremas y con decisiones que puedan sostener en su vida real.
              </p>
              <p className="mt-4 text-sm text-ink/60">Lic. en Nutrición · NutriWeb</p>
            </div>
          </div>

          <dl className="mt-12 grid gap-6 border-t border-leaf/20 pt-8 sm:grid-cols-3">
            {[
              { value: "+5 años", label: "de experiencia clínica" },
              { value: "+200", label: "pacientes acompañados" },
              { value: "1 a 1", label: "atención personalizada" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="font-display text-3xl font-extrabold text-leaf-deep">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-sm text-ink/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink px-5 py-14 text-paper sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="font-display text-4xl font-extrabold tracking-[-0.04em]">
                NutriWeb
              </p>
              <p className="mt-2 max-w-sm text-sm text-paper/60">
                Planes, eBooks y consultas para comer mejor sin complicarte la
                vida.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/70">
              {[
                { href: "#planes", label: "Planes" },
                { href: "#ebooks", label: "eBooks" },
                { href: "#agendar", label: "Citas" },
                { href: "#nutricionista", label: "Nutricionista" },
                { href: "/dashboard", label: "Mi panel" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition hover:text-lime"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-paper/40">
            <p>&copy; {new Date().getFullYear()} NutriWeb. Todos los derechos reservados.</p>
            <p>Hecho con calma en Bolivia.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
