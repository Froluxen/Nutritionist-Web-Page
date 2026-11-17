"use client";

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, QrCode, Save, Upload } from "lucide-react";
import { savePaymentSettings } from "@/app/actions/settings";

export type PaymentSettingsValues = {
  qrUrl: string | null;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  paymentNote: string | null;
};

const fieldClass =
  "w-full rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-leaf focus:bg-sheet focus:outline-none focus:ring-2 focus:ring-leaf/20";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-muted";

export default function PaymentSettingsForm({
  settings,
}: {
  settings: PaymentSettingsValues;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [bankName, setBankName] = useState(settings.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(
    settings.accountHolder ?? "",
  );
  const [accountNumber, setAccountNumber] = useState(
    settings.accountNumber ?? "",
  );
  const [paymentNote, setPaymentNote] = useState(settings.paymentNote ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(settings.qrUrl);
  const [removeQr, setRemoveQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNotice(null);
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setError("Formato no válido. Sube el QR en PNG, JPG o WEBP.");
      return;
    }
    if (selected.size > 2 * 1024 * 1024) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setError("La imagen del QR supera los 2 MB.");
      return;
    }

    setFile(selected);
    setRemoveQr(false);
    setPreview(URL.createObjectURL(selected));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const formData = new FormData();
    formData.set("bank_name", bankName);
    formData.set("account_holder", accountHolder);
    formData.set("account_number", accountNumber);
    formData.set("payment_note", paymentNote);
    if (file) formData.set("qr", file);
    if (removeQr) formData.set("remove_qr", "on");

    startTransition(async () => {
      const result = await savePaymentSettings(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (removeQr) setPreview(null);
      setFile(null);
      setRemoveQr(false);
      if (inputRef.current) inputRef.current.value = "";
      setNotice("Ajustes guardados. El checkout ya usa estos datos.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-line bg-sheet p-5 sm:p-7"
    >
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <div>
          <span className={labelClass}>QR de cobro</span>
          <div className="rounded-2xl border border-line bg-paper/60 p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Vista previa del QR de pago"
                className="mx-auto aspect-square w-full rounded-xl bg-sheet object-contain p-2"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed border-line text-center">
                <QrCode className="h-10 w-10 text-muted/50" aria-hidden="true" />
                <p className="mt-2 px-3 text-xs text-muted">
                  Sin QR configurado. El checkout mostrará un aviso a los clientes.
                </p>
              </div>
            )}
          </div>

          <label
            htmlFor="qr-file"
            className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-paper/50 px-3 py-2.5 text-sm font-medium text-ink transition hover:border-leaf/50 hover:bg-mint/30"
          >
            <Upload className="h-4 w-4 text-leaf" aria-hidden="true" />
            {file ? "Cambiar imagen" : preview ? "Reemplazar QR" : "Subir QR"}
          </label>
          <input
            ref={inputRef}
            id="qr-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            className="sr-only"
          />
          <p className="mt-1.5 text-xs text-muted">PNG, JPG o WEBP · máx. 2 MB</p>

          {preview && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={removeQr}
                onChange={(e) => {
                  setRemoveQr(e.target.checked);
                  if (e.target.checked) {
                    setFile(null);
                    setPreview(null);
                    if (inputRef.current) inputRef.current.value = "";
                  } else {
                    setPreview(settings.qrUrl);
                  }
                }}
                className="h-3.5 w-3.5 accent-[var(--color-leaf)]"
              />
              Quitar el QR actual
            </label>
          )}

          {file && (
            <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-leaf-deep">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {file.name}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bank-name" className={labelClass}>
                Banco
              </label>
              <input
                id="bank-name"
                maxLength={120}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Banco Unión"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="account-holder" className={labelClass}>
                Titular de la cuenta
              </label>
              <input
                id="account-holder"
                maxLength={120}
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Nombre completo"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="account-number" className={labelClass}>
              Número de cuenta / alias
            </label>
            <input
              id="account-number"
              maxLength={60}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="0000-0000-0000"
              className={`${fieldClass} font-mono`}
            />
          </div>

          <div>
            <label htmlFor="payment-note" className={labelClass}>
              Nota para el cliente (opcional)
            </label>
            <textarea
              id="payment-note"
              rows={3}
              maxLength={300}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Ej.: escribe el código de referencia en la glosa y envíanos el comprobante."
              className={`${fieldClass} resize-none`}
            />
            <p className="mt-1.5 text-xs text-muted">
              Se muestra debajo del QR en la pantalla de pago.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl bg-mint px-3.5 py-2.5 text-sm font-medium text-leaf-deep"
            >
              {notice}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {pending ? "Guardando…" : "Guardar ajustes"}
            </button>
            {preview && !file && (
              <span className="text-xs text-muted">
                Marca “Quitar” y guarda para eliminar el QR.
              </span>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
