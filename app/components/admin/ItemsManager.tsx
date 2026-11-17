"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  BookOpen,
  CalendarRange,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapDbError } from "@/lib/auth-errors";
import { formatPrice } from "@/lib/types";

export type CatalogItem = {
  id: string;
  item_type: "plan" | "ebook";
  name: string;
  description: string | null;
  price: number;
  status: boolean;
  author: string | null;
  file_path: string | null;
  plan_duration_days: number | null;
  plan_type: string | null;
};

type Filter = "all" | "plan" | "ebook";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

const emptyForm = {
  item_type: "plan" as "plan" | "ebook",
  name: "",
  description: "",
  price: "",
  author: "",
  plan_duration_days: "",
  plan_type: "",
};

const fieldClass =
  "w-full rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-leaf focus:bg-sheet focus:outline-none focus:ring-2 focus:ring-leaf/20";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-muted";

function pdfStoragePath(itemId: string, file: File) {
  const base =
    file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ebook";
  return `${itemId}/${Date.now()}-${base}.pdf`;
}

export default function ItemsManager({
  initialItems,
}: {
  initialItems: CatalogItem[];
}) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("items")
      .select(
        "id, item_type, name, description, price, status, ebooks(author, file_path), plans(plan_duration_days, plan_type)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (loadError) {
      setError(mapDbError(loadError.message));
      return;
    }

    setItems(
      (data ?? []).map((row) => ({
        id: row.id,
        item_type: row.item_type,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        status: row.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        author: ((row as any).ebooks?.author ?? null) as string | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        file_path: ((row as any).ebooks?.file_path ?? null) as string | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plan_duration_days: ((row as any).plans?.plan_duration_days ??
          null) as number | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plan_type: ((row as any).plans?.plan_type ?? null) as string | null,
      })),
    );
  }, []);

  function resetForm() {
    setEditingItem(null);
    setForm(emptyForm);
    setPdfFile(null);
    setRemovePdf(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(item: CatalogItem) {
    setEditingItem(item);
    setForm({
      item_type: item.item_type,
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      author: item.author ?? "",
      plan_duration_days:
        item.plan_duration_days != null ? String(item.plan_duration_days) : "",
      plan_type: item.plan_type ?? "",
    });
    setPdfFile(null);
    setRemovePdf(false);
    setError(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePdfChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNotice(null);
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setPdfFile(null);
      return;
    }
    if (selected.type !== "application/pdf") {
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("El archivo del eBook debe ser un PDF.");
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("El PDF supera el límite de 25 MB.");
      return;
    }
    setPdfFile(selected);
    setRemovePdf(false);
  }

  async function uploadPdf(itemId: string, file: File) {
    const supabase = createClient();
    const path = pdfStoragePath(itemId, file);
    const { error: uploadError } = await supabase.storage
      .from("ebooks")
      .upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) throw uploadError;
    return path;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) return setError("Ingresa un nombre para el producto.");
    if (!form.price.trim() || !Number.isFinite(price) || price < 0) {
      return setError("Ingresa un precio válido mayor o igual a 0.");
    }

    const durationRaw = form.plan_duration_days.trim();
    const duration = durationRaw ? Number(durationRaw) : null;
    if (
      form.item_type === "plan" &&
      duration !== null &&
      (!Number.isInteger(duration) || duration <= 0)
    ) {
      return setError("La duración debe ser un número entero de días mayor que 0.");
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const base = {
        name,
        description: form.description.trim() || null,
        price,
      };

      if (editingItem) {
        const { error: itemError } = await supabase
          .from("items")
          .update(base)
          .eq("id", editingItem.id);
        if (itemError) throw itemError;

        if (editingItem.item_type === "ebook") {
          let nextPath: string | null = editingItem.file_path;

          if (pdfFile) {
            nextPath = await uploadPdf(editingItem.id, pdfFile);
          } else if (removePdf) {
            nextPath = null;
          }

          const { error: ebookError } = await supabase
            .from("ebooks")
            .update({
              author: form.author.trim() || null,
              file_path: nextPath,
            })
            .eq("id", editingItem.id);

          if (ebookError) {
            if (nextPath && nextPath !== editingItem.file_path) {
              await supabase.storage.from("ebooks").remove([nextPath]);
            }
            throw ebookError;
          }

          if (
            editingItem.file_path &&
            editingItem.file_path !== nextPath &&
            (pdfFile || removePdf)
          ) {
            await supabase.storage
              .from("ebooks")
              .remove([editingItem.file_path]);
          }

          setNotice(
            pdfFile
              ? "eBook actualizado y PDF reemplazado."
              : "eBook actualizado.",
          );
        } else {
          const { error: planError } = await supabase
            .from("plans")
            .update({
              plan_duration_days: duration,
              plan_type: form.plan_type.trim() || null,
            })
            .eq("id", editingItem.id);
          if (planError) throw planError;
          setNotice("Plan actualizado.");
        }
      } else {
        const { data: item, error: itemError } = await supabase
          .from("items")
          .insert({
            ...base,
            item_type: form.item_type,
            status: true,
          })
          .select("id")
          .single();

        if (itemError || !item) throw itemError ?? new Error("No se creó el producto.");

        try {
          if (form.item_type === "ebook") {
            const { error: ebookError } = await supabase
              .from("ebooks")
              .insert({
                id: item.id,
                author: form.author.trim() || null,
                file_path: null,
              });
            if (ebookError) throw ebookError;

            if (pdfFile) {
              const path = await uploadPdf(item.id, pdfFile);
              const { error: pathError } = await supabase
                .from("ebooks")
                .update({ file_path: path })
                .eq("id", item.id);
              if (pathError) {
                await supabase.storage.from("ebooks").remove([path]);
                throw pathError;
              }
            }
            setNotice(
              pdfFile
                ? "eBook publicado con su PDF."
                : "eBook publicado. Puedes subir el PDF después.",
            );
          } else {
            const { error: planError } = await supabase.from("plans").insert({
              id: item.id,
              plan_duration_days: duration,
              plan_type: form.plan_type.trim() || null,
            });
            if (planError) throw planError;
            setNotice("Plan publicado en el catálogo.");
          }
        } catch (subError) {
          // Si falla la subclase o el PDF, deshace el item para no dejar huérfanos.
          await supabase.from("items").delete().eq("id", item.id);
          throw subError;
        }
      }

      resetForm();
      await loadItems();
    } catch (err) {
      setError(
        mapDbError(err instanceof Error ? err.message : "No se pudo guardar."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: CatalogItem) {
    setError(null);
    const supabase = createClient();
    const { error: toggleError } = await supabase
      .from("items")
      .update({ status: !item.status })
      .eq("id", item.id);
    if (toggleError) return setError(mapDbError(toggleError.message));
    setNotice(item.status ? "Producto oculto del sitio." : "Producto publicado.");
    await loadItems();
  }

  async function handleDelete(item: CatalogItem) {
    if (
      !window.confirm(
        `¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", item.id);
    if (deleteError) return setError(mapDbError(deleteError.message));
    if (item.file_path) {
      await supabase.storage.from("ebooks").remove([item.file_path]);
    }
    if (editingItem?.id === item.id) resetForm();
    setNotice("Producto eliminado.");
    await loadItems();
  }

  const visibleItems =
    filter === "all" ? items : items.filter((item) => item.item_type === filter);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-line bg-sheet p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {editingItem ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {editingItem
                ? `Estás editando “${editingItem.name}”.`
                : "Un plan incluye agenda de cita; un eBook incluye su PDF."}
            </p>
          </div>
          {editingItem && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <fieldset>
            <legend className={labelClass}>Tipo de producto</legend>
            <div className="inline-flex rounded-full border border-line bg-paper/60 p-1">
              {(
                [
                  { value: "plan", label: "Plan", icon: CalendarRange },
                  { value: "ebook", label: "eBook", icon: BookOpen },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  disabled={!!editingItem}
                  onClick={() => setForm({ ...form, item_type: value })}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
                    form.item_type === value
                      ? "bg-ink text-paper"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="item-name" className={labelClass}>
                Nombre
              </label>
              <input
                id="item-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  form.item_type === "plan" ? "Plan mensual" : "Guía de desayunos"
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="item-price" className={labelClass}>
                Precio (USD)
              </label>
              <input
                id="item-price"
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="49.00"
                className={fieldClass}
              />
            </div>
          </div>

          {form.item_type === "plan" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="item-duration" className={labelClass}>
                  Duración (días)
                </label>
                <input
                  id="item-duration"
                  type="number"
                  min="1"
                  step="1"
                  value={form.plan_duration_days}
                  onChange={(e) =>
                    setForm({ ...form, plan_duration_days: e.target.value })
                  }
                  placeholder="30"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="item-plan-type" className={labelClass}>
                  Etiqueta del plan (opcional)
                </label>
                <input
                  id="item-plan-type"
                  maxLength={60}
                  value={form.plan_type}
                  onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
                  placeholder="Mensual, deportivo, embarazo…"
                  className={fieldClass}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="item-author" className={labelClass}>
                  Autor (opcional)
                </label>
                <input
                  id="item-author"
                  maxLength={120}
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="Lic. en Nutrición"
                  className={fieldClass}
                />
              </div>
              <div>
                <span className={labelClass}>Archivo PDF</span>
                <label
                  htmlFor="item-pdf"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-paper/50 px-3.5 py-2.5 text-sm text-muted transition hover:border-leaf/50 hover:bg-mint/30"
                >
                  <FileUp className="h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    {pdfFile
                      ? pdfFile.name
                      : editingItem?.file_path
                        ? "Reemplazar PDF actual"
                        : "Subir PDF (máx. 25 MB)"}
                  </span>
                </label>
                <input
                  ref={fileInputRef}
                  id="item-pdf"
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className="sr-only"
                />
                {editingItem?.item_type === "ebook" && editingItem.file_path && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={removePdf}
                      onChange={(e) => {
                        setRemovePdf(e.target.checked);
                        if (e.target.checked) {
                          setPdfFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                      }}
                      className="h-3.5 w-3.5 accent-[var(--color-leaf)]"
                    />
                    Quitar el PDF actual
                  </label>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="item-desc" className={labelClass}>
              Descripción
            </label>
            <textarea
              id="item-desc"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qué incluye y para quién es…"
              className={`${fieldClass} resize-none`}
            />
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-leaf-deep disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : editingItem ? (
                <Save className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {saving
                ? "Guardando…"
                : editingItem
                  ? "Guardar cambios"
                  : "Publicar producto"}
            </button>
            {editingItem && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">
            Productos ({items.length})
          </h2>
          <div className="flex gap-1 rounded-full border border-line bg-sheet p-1">
            {(
              [
                { value: "all", label: "Todos" },
                { value: "plan", label: "Planes" },
                { value: "ebook", label: "eBooks" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === value
                    ? "bg-ink text-paper"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <p className="mt-4 rounded-3xl border border-dashed border-line bg-sheet p-8 text-center text-sm text-muted">
            No hay productos en esta categoría. Crea el primero arriba.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-sheet p-5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.item_type === "plan"
                          ? "bg-mint text-leaf-deep"
                          : "bg-ink text-paper"
                      }`}
                    >
                      {item.item_type === "plan" ? (
                        <CalendarRange className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <BookOpen className="h-3 w-3" aria-hidden="true" />
                      )}
                      {item.item_type === "plan" ? "Plan" : "eBook"}
                    </span>
                    {!item.status && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Oculto
                      </span>
                    )}
                    {item.item_type === "ebook" && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.file_path
                            ? "bg-mint text-leaf-deep"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        {item.file_path ? "PDF cargado" : "Sin PDF"}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold leading-tight text-ink">
                    {item.name}
                  </h3>
                  {item.item_type === "plan" &&
                    (item.plan_duration_days || item.plan_type) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          item.plan_duration_days
                            ? `${item.plan_duration_days} días`
                            : null,
                          item.plan_type,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  {item.item_type === "ebook" && item.author && (
                    <p className="mt-0.5 text-xs text-muted">por {item.author}</p>
                  )}
                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="font-display text-2xl font-bold text-ink">
                    {formatPrice(item.price)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleActive(item)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
                    >
                      {item.status ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {item.status ? "Ocultar" : "Publicar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Editar ${item.name}`}
                      className="rounded-full border border-line p-2 text-muted transition hover:text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      aria-label={`Eliminar ${item.name}`}
                      className="rounded-full border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
