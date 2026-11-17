import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Descarga protegida de eBooks.
 *
 * 1. Exige sesión.
 * 2. Verifica que exista una compra PAGADA del usuario para ese ítem.
 * 3. Genera una URL firmada de corta duración (bucket privado `ebooks`).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const { data: item } = await supabase
    .from("items")
    .select("id, item_type, ebooks(file_path)")
    .eq("id", itemId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filePath = ((item?.ebooks as any)?.file_path ?? null) as string | null;
  if (!item || item.item_type !== "ebook" || !filePath) {
    return new NextResponse("Archivo no disponible.", { status: 404 });
  }

  const { data: purchase } = await supabase
    .from("order_details")
    .select("id, orders!inner(user_id, status)")
    .eq("item_id", itemId)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "paid")
    .limit(1)
    .maybeSingle();

  if (!purchase) {
    return new NextResponse(
      "Necesitas una compra pagada para descargar este eBook.",
      { status: 403 },
    );
  }

  const { data: signed, error } = await supabase.storage
    .from("ebooks")
    .createSignedUrl(filePath, 120);

  if (error || !signed?.signedUrl) {
    return new NextResponse("No se pudo generar la descarga. Inténtalo de nuevo.", {
      status: 500,
    });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
