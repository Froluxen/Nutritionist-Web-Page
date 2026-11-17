"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/auth-errors";

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

const MAX_QR_BYTES = 2 * 1024 * 1024;
const QR_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    throw new Error("No tienes permiso para esa acción.");
  }

  return { supabase, userId: user.id };
}

function clean(value: FormDataEntryValue | null, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

/**
 * Guarda los datos de cobro y, si se adjunta una imagen, reemplaza el QR del
 * bucket público `assets`. La fila de `settings` es única (`id = true`).
 */
export async function savePaymentSettings(
  formData: FormData,
): Promise<SettingsActionResult> {
  try {
    const { supabase, userId } = await requireAdmin();

    const bankName = clean(formData.get("bank_name"), 120);
    const accountHolder = clean(formData.get("account_holder"), 120);
    const accountNumber = clean(formData.get("account_number"), 60);
    const paymentNote = clean(formData.get("payment_note"), 300);
    const removeQr = formData.get("remove_qr") === "on";

    const file = formData.get("qr");
    const hasNewFile = file instanceof File && file.size > 0;

    if (hasNewFile) {
      if (file.size > MAX_QR_BYTES) {
        return { ok: false, error: "La imagen del QR supera los 2 MB." };
      }
      const ext = QR_MIME_EXT[file.type];
      if (!ext) {
        return {
          ok: false,
          error: "Formato no válido. Sube el QR en PNG, JPG o WEBP.",
        };
      }
    }

    const { data: current, error: readError } = await supabase
      .from("settings")
      .select("qr_path")
      .eq("id", true)
      .maybeSingle();

    if (readError) {
      return { ok: false, error: mapDbError(readError.message) };
    }

    const previousPath: string | null = current?.qr_path ?? null;
    let qrPath: string | null = previousPath;
    let uploadedPath: string | null = null;

    if (hasNewFile) {
      const ext = QR_MIME_EXT[file.type];
      const nextPath = `qr/qr-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(nextPath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        });

      if (uploadError) {
        return { ok: false, error: mapDbError(uploadError.message) };
      }

      uploadedPath = nextPath;
      qrPath = nextPath;
    } else if (removeQr) {
      qrPath = null;
    }

    const { error: upsertError } = await supabase.from("settings").upsert(
      {
        id: true,
        qr_path: qrPath,
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        payment_note: paymentNote,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      if (uploadedPath) {
        // No dejes el archivo nuevo huérfano si falla el guardado del registro.
        await supabase.storage.from("assets").remove([uploadedPath]);
      }
      return { ok: false, error: mapDbError(upsertError.message) };
    }

    // El archivo anterior se elimina solo cuando el registro ya apunta al nuevo.
    if (previousPath && previousPath !== qrPath) {
      await supabase.storage.from("assets").remove([previousPath]);
    }

    revalidatePath("/dashboard/admin/ajustes");
    revalidatePath("/dashboard/admin");
    revalidatePath("/");
    revalidatePath("/pagar/[orderId]", "page");

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar.",
    };
  }
}
