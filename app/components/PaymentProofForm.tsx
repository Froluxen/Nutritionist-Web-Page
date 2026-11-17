"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapDbError } from "@/lib/auth-errors";
import {
  MAX_PROOF_BYTES,
  PROOF_MIME_TYPES,
  formatBytes,
} from "@/lib/payment";

type Props = {
  orderId: string;
  amount: number;
  hasProof: boolean;
};

export default function PaymentProofForm({ orderId, amount, hasProof }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!PROOF_MIME_TYPES.includes(selected.type as (typeof PROOF_MIME_TYPES)[number])) {
      setFile(null);
      setError("Formato no válido. Sube una imagen (JPG, PNG, WEBP) o un PDF.");
      return;
    }
    if (selected.size > MAX_PROOF_BYTES) {
      setFile(null);
      setError(`El archivo supera el límite de ${formatBytes(MAX_PROOF_BYTES)}.`);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit() {
    if (!file) {
      setError("Selecciona la imagen o PDF de tu comprobante.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("auth-required");

      const ext =
        file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ??
        "bin";
      // La carpeta debe ser el ID de la orden (policy de storage).
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("payment_proofs")
        .insert({
          order_id: orderId,
          amount_declared: amount,
          storage_path: path,
          note: note.trim().slice(0, 300) || null,
        });

      if (insertError) {
        // Evita dejar un archivo huérfano si el registro falla.
        await supabase.storage.from("payment-proofs").remove([path]);
        throw insertError;
      }

      setDone(true);
      setFile(null);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg === "auth-required"
          ? "Tu sesión expiró. Vuelve a iniciar sesión."
          : mapDbError(msg),
      );
    } finally {
      setPending(false);
    }
  }

  const inputId = `proof-${orderId}`;

  return (
    <div>
      {hasProof && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-lime bg-lime/25 p-4 text-sm text-ink">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-leaf-deep" aria-hidden="true" />
          <p>
            Ya recibimos un comprobante de esta orden. Está{" "}
            <strong>en revisión</strong>: te avisaremos cuando el pago quede
            confirmado. Si te equivocaste de archivo, puedes enviar otro.
          </p>
        </div>
      )}

      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-paper/50 px-6 py-8 text-center transition hover:border-leaf/50 hover:bg-mint/30"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-leaf-deep">
          <FileUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="mt-2 text-sm font-semibold text-ink">
          {file ? file.name : "Subir comprobante"}
        </span>
        <span className="mt-1 text-xs text-muted">
          Imagen o PDF · máximo {formatBytes(MAX_PROOF_BYTES)}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PROOF_MIME_TYPES.join(",")}
          onChange={handleFile}
          className="sr-only"
        />
      </label>

      <div className="mt-4">
        <label
          htmlFor={`note-${orderId}`}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-muted"
        >
          Nota para la nutricionista (opcional)
        </label>
        <textarea
          id={`note-${orderId}`}
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: pagué desde la cuenta de mi mamá, titular Ana Pérez."
          className="w-full resize-none rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/50 focus:border-leaf focus:bg-sheet focus:outline-none focus:ring-2 focus:ring-leaf/20"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {done ? (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-2xl bg-mint p-3.5 text-sm font-medium text-leaf-deep"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          Comprobante enviado. Revisaremos tu pago y te confirmaremos por correo.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending
            ? "Enviando…"
            : hasProof
              ? "Enviar otro comprobante"
              : "Enviar comprobante"}
        </button>
      )}
    </div>
  );
}
