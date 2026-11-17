import { Banknote, Info, LockKeyhole, QrCode } from "lucide-react";
import { getPaymentSettings } from "@/lib/settings";
import PaymentSettingsForm from "@/app/components/admin/PaymentSettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getPaymentSettings();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-leaf">Cobros</p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-extrabold leading-tight text-ink">
          Ajustes de pago
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Sube el QR fijo de tu banco y edita los datos que ven los clientes al
          pagar. No hay pasarela: cada transferencia se confirma manualmente
          desde la sección de pagos.
        </p>
      </header>

      {!settings.tableReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            La tabla de ajustes todavía no está disponible. Ejecuta la migración
            v3 en Supabase para poder guardar desde aquí. Mientras tanto se usan
            las variables de entorno.
          </p>
        </div>
      )}

      <PaymentSettingsForm
        settings={{
          qrUrl: settings.qrUrl,
          bankName: settings.bankName,
          accountHolder: settings.accountHolder,
          accountNumber: settings.accountNumber,
          paymentNote: settings.paymentNote,
        }}
      />

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            icon: QrCode,
            title: "Un QR fijo",
            text: "El cliente escanea, transfiere el importe exacto y escribe el código de referencia en la glosa.",
          },
          {
            icon: Banknote,
            title: "Confirmación manual",
            text: "Contrasta el comprobante con tu app bancaria y confirma el pago desde la cola de pagos.",
          },
          {
            icon: LockKeyhole,
            title: "Archivos protegidos",
            text: "El QR es público; los comprobantes y los PDFs de eBooks quedan en buckets privados.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-3xl border border-line bg-sheet p-5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-leaf-deep">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="mt-3 font-display text-lg font-bold text-ink">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
