"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";

export default function QrImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="mx-auto flex aspect-square w-full max-w-52 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper/60 p-4 text-center">
        <QrCode className="h-10 w-10 text-muted/50" aria-hidden="true" />
        <p className="mt-2 text-xs text-muted">
          El QR no está disponible en este momento. Escríbenos para enviártelo.
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Código QR para realizar el pago"
      width={224}
      height={224}
      onError={() => setFailed(true)}
      className="mx-auto aspect-square w-full max-w-52 rounded-2xl border border-line bg-sheet object-contain p-2"
    />
  );
}
