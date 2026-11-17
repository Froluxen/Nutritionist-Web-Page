# NutriWeb

Tienda de nutrición: planes y eBooks, cobro por **QR bancario con confirmación
asistida**, descargas protegidas y citas solo para clientes con un plan pagado.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase
  (Auth + Postgres + Storage), Vercel.
- **Costo:** $0 (Supabase Free + Vercel Free + QR del banco).
- **Plan y decisiones:** ver [`docs/plan.md`](docs/plan.md).
- **Esquema de base de datos:** [`supabase/schema.sql`](supabase/schema.sql).

## Requisitos

- Node.js 20+
- Un proyecto de Supabase con el esquema de `supabase/schema.sql` aplicado

## Configuración

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y completa los valores:

   | Variable | Obligatoria | Descripción |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | sí | URL del proyecto Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sí | Publishable key (nunca `service_role`) |
   | `NEXT_PUBLIC_PAYMENT_QR_URL` | no | Respaldo: imagen del QR si aún no subiste una en **Ajustes** |
   | `NEXT_PUBLIC_PAYMENT_BANK_NAME` | no | Respaldo: banco de la pantalla de pago |
   | `NEXT_PUBLIC_PAYMENT_ACCOUNT_HOLDER` | no | Respaldo: titular de la cuenta |
   | `NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER` | no | Respaldo: número de cuenta |

   Los datos de cobro se administran desde **Administración → Ajustes** y se
   guardan en la tabla `public.settings`. Las variables de entorno solo se usan
   como respaldo si esa tabla aún no existe.

3. Levanta el entorno local:

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Cómo funciona el pago

1. El cliente pulsa **Comprar** → la RPC `create_order` crea la orden con el
   precio del servidor y un `reference_code` (ej. `NW-4F7K2`).
2. En `/pagar/[orderId]` ve el QR, el importe exacto y el código de referencia.
3. Transfiere escribiendo el código en la **glosa** y sube su comprobante
   (imagen o PDF, máx. 5 MB) al bucket privado `payment-proofs`.
4. En **Administración → Pagos**, la nutrióloga compara el comprobante con su
   app bancaria y pulsa **Confirmar pago** (RPC `confirm_payment`).
5. La orden pasa a `paid`: se habilitan las descargas y las citas.

### Cancelación y rechazo

- El **cliente** puede cancelar una orden pendiente desde su panel o desde el
  checkout. Se registra `cancelled_at`, `cancelled_by` y el motivo.
- El **admin** puede rechazar un pago desde la cola indicando un motivo; la
  orden queda cancelada y el cliente ve la razón en su panel.
- Ambas operaciones pasan por la RPC segura `cancel_order`, que solo permite
  órdenes `pending` y valida dueño o rol admin.

## Administración

El panel `/dashboard/admin` agrupa la operación diaria:

- **Resumen:** métricas de pagos, ventas, citas y productos activos.
- **Pagos:** verifica comprobantes firmados y confirma o cancela órdenes.
- **Catálogo:** crea y edita planes/eBooks y **sube el PDF** de cada eBook.
- **Citas:** confirma solicitudes, marca consultas completadas y cancela.
- **Ajustes:** sube el QR del banco y edita los datos de cobro.

## Cargar contenido

### QR de pago

En **Administración → Ajustes** sube la imagen del QR (PNG, JPG o WEBP, máx.
2 MB). Se guarda en el bucket público `assets` y se muestra automáticamente en
`/pagar/[orderId]`. El QR anterior se borra al reemplazarlo.

### eBooks (PDF)

1. En **Administración → Catálogo** crea el eBook (nombre, precio, autor).
2. Adjunta el PDF en el mismo formulario (máx. 25 MB). Se sube al bucket
   **privado** `ebooks` en la ruta `<id-del-ebook>/<archivo>.pdf`.
3. También puedes reemplazar o quitar el PDF editando el eBook.

Las descargas pasan por `/downloads/[itemId]`, que verifica la compra pagada y
redirige a una URL firmada de 2 minutos.

## Reglas de negocio (aplicadas en la base)

- El precio y los estados de pago solo cambian desde las RPCs del servidor.
- El cliente no puede modificar su `role` (grants por columna).
- Una cita exige una compra **pagada** de un **plan** del mismo usuario.
- Solo puede haber **1 cita activa por compra** y sin solapamientos de horario.
- Los eBooks y comprobantes viven en buckets privados.

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # build de producción
npm run lint     # ESLint
npx tsc --noEmit # verificación de tipos
```

## Despliegue (Vercel)

1. Importa el repositorio en Vercel.
2. Configura las mismas variables de entorno del `.env.local`.
3. Despliega. Las rutas dinámicas (`/pagar/[orderId]`, `/downloads/[itemId]`,
   `/dashboard`) se ejecutan en el servidor, no necesitan configuración extra.

En Supabase, recuerda:

- Aplicar `supabase/schema.sql` en el SQL Editor (operación destructiva: hace
  reset de las tablas `public`).
- Mantener los buckets `ebooks` y `payment-proofs` como **privados** y `assets`
  como **público** (solo el admin escribe en él).
- Configurar las URLs de redirección de Auth (`/auth/confirm`) con el dominio de
  producción.
