"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el valor sigue visible para copiar a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copiar ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sheet px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-leaf/50 hover:bg-mint/40"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
