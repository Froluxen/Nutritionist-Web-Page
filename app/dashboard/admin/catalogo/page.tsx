import { createClient } from "@/lib/supabase/server";
import ItemsManager, {
  type CatalogItem,
} from "@/app/components/admin/ItemsManager";

type Row = {
  id: string;
  item_type: "plan" | "ebook";
  name: string;
  description: string | null;
  price: number;
  status: boolean;
  ebooks: { author: string | null; file_path: string | null } | null;
  plans: { plan_duration_days: number | null; plan_type: string | null } | null;
};

export default async function AdminCatalogPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("items")
    .select(
      "id, item_type, name, description, price, status, ebooks(author, file_path), plans(plan_duration_days, plan_type)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const items: CatalogItem[] = ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    item_type: row.item_type,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    status: row.status,
    author: row.ebooks?.author ?? null,
    file_path: row.ebooks?.file_path ?? null,
    plan_duration_days: row.plans?.plan_duration_days ?? null,
    plan_type: row.plans?.plan_type ?? null,
  }));

  const plans = items.filter((item) => item.item_type === "plan");
  const ebooks = items.filter((item) => item.item_type === "ebook");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-leaf">Tienda</p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3.5vw,2.6rem)] font-extrabold leading-tight text-ink">
          Catálogo
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Crea planes y eBooks, ajusta precios y sube el PDF de cada eBook al
          almacenamiento privado. Solo los productos publicados aparecen en la
          página principal.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-mint px-3 py-1 font-medium text-leaf-deep">
            {plans.length} {plans.length === 1 ? "plan" : "planes"}
          </span>
          <span className="rounded-full bg-mint px-3 py-1 font-medium text-leaf-deep">
            {ebooks.length} {ebooks.length === 1 ? "eBook" : "eBooks"}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
            {ebooks.filter((ebook) => !ebook.file_path).length} sin PDF
          </span>
        </div>
      </header>

      <ItemsManager initialItems={items} />
    </div>
  );
}
