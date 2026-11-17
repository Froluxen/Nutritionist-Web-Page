"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapDbError } from "@/lib/auth-errors";

export default function CancelAppointmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm("¿Cancelar esta cita? Esta acción no se puede deshacer.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("cancel_appointment", {
        p_id: id,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (e) {
      setError(mapDbError(e instanceof Error ? e.message : ""));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium text-muted transition hover:text-red-700 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <XCircle className="h-3 w-3" aria-hidden="true" />
        )}
        Cancelar cita
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
