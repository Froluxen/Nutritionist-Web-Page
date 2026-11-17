# NutriWeb — Plan de proyecto v2 (alcance, arquitectura y datos)

**Proyecto:** `frontend-nutricion`
**Fecha:** 11 de noviembre de 2026
**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase (Auth + Postgres + Storage), Vercel
**Modelo:** 1 desarrollador, negocio real en producción
**Costo objetivo:** $0 (Supabase Free + Vercel Free + QR del banco)
**Estado:** Planificación cerrada. Sin datos en Supabase → el esquema se reescribe desde cero (`supabase/schema.sql`), **sin migraciones**.

> Este documento reemplaza la auditoría preliminar anterior. Las decisiones aquí
> definidas son la referencia para la implementación.

---

## 1. Objetivo

Sitio de nutrición que vende **planes** y **ebooks**, cobra por **QR bancario con
confirmación asistida**, entrega **descargas protegidas** y agenda **citas solo
para clientes con un plan pagado**, con un **panel de administración** para la
nutrióloga.

---

## 2. Alcance: qué DEBE hacer (v1)

| Módulo | Funcionalidad |
|---|---|
| Catálogo | Landing + detalle de planes (features, duración) y ebooks activos. Solo lectura pública |
| Auth | Registro, login, confirmación por email, logout. Perfil editable (nombre, teléfono) |
| Compras | Orden de **1 ítem**, precio fijado en el servidor, estado `pending` |
| Pagos QR | Mostrar QR fijo del banco + **código de orden único** (glosa) + subida del comprobante por el cliente |
| Confirmación | Cola de pagos pendientes en el panel admin; el admin verifica contra su app bancaria y confirma **con 1 clic** |
| Descargas | PDF del ebook solo con orden **pagada**; URL firmada de corta duración desde bucket privado |
| Citas | Reserva **solo con plan pagado**; **1 cita activa por compra**; sin solapamientos; tipos Presencial/Online; cancelar/reprogramar con reglas |
| Admin | CRUD de catálogo (items/plans/ebooks/features), verificación de pagos, gestión de citas |
| Seguridad | RLS completa; el cliente nunca puede cambiar su rol, precios ni estados de pago |

## 3. Alcance: qué NO debe hacer (v1, fuera de alcance)

- ❌ Carrito con varios ítems (compra simple: 1 producto por orden)
- ❌ Pasarela internacional (Stripe/PayPal) y webhooks de pago
- ❌ Suscripciones o cobros recurrentes automáticos
- ❌ Multi-nutriólogo / agendas múltiples (1 sola agenda)
- ❌ Facturación electrónica (SIAT) — backlog
- ❌ Notificaciones automáticas por WhatsApp/SMS
- ❌ Microservicios, colas, observabilidad compleja
- ❌ Suite e2e completa: solo `typecheck`, `lint`, `build` y verificación manual guiada de los flujos críticos
- ❌ Cualquier servicio de pago o infraestructura con costo

---

## 4. Decisiones de negocio

| Decisión | Valor |
|---|---|
| Citas habilitadas por | Compra de **plan** exclusivamente (un ebook **no** da derecho a consulta) |
| Método de pago | **QR fijo del banco + comprobante + confirmación manual del admin** |
| Verificación de pago | Asistida: el admin contrasta comprobante/glosa contra la notificación del banco y pulsa "Confirmar pago" |
| Precio | Siempre calculado en servidor desde `items.price`; el cliente no envía importes |
| Entrega de ebooks | Bucket **privado** + Route Handler con verificación de compra + URL firmada temporal |
| Datos | Sin datos previos → reset total del esquema, sin historial de migraciones |

### 4.1. Investigación de pagos QR (Bolivia)

- **QR BCB Bolivia** es el QR interoperable oficial del Estado (BCB). Pagar y
  cobrar con él es gratuito para el usuario y el comercio.
- **No existe** una API pública gratuita, sin trámites, que genere QRs de cobro
  ni que notifique/verifique pagos automáticamente. La generación y la
  notificación pasan por la **entidad financiera** del comercio (app del banco o
  API de banca empresa, esta última con registro y posible costo).
- Por eso v1 usa: **QR fijo gratuito del banco + código de orden único en la
  glosa + comprobante subido + confirmación asistida**.
- La arquitectura deja el módulo de pagos **enchufable** a una API bancaria
  (webhook/consulta) para automatizar en el futuro sin rehacer el modelo.

---

## 5. Arquitectura

Monolito modular sobre Next.js App Router + Supabase como BaaS. Sin backend
propio, sin microservicios.

```text
Interfaz (RSC + Client Components)
        ↓
Server Actions / Route Handlers
        ↓
RPC de Postgres (validación y transacciones)
        ↓
Postgres + RLS · Auth (GoTrue) · Storage privado
```

Reglas:

1. Las páginas no concentran reglas de negocio; delegan en Server Actions/RPC.
2. Operaciones sensibles (precio, estados, roles, disponibilidad) se validan en servidor y en RLS.
3. La clave `service_role` nunca llega al cliente; el cliente browser usa solo la publishable key.
4. Storage privado: ningún enlace permanente público a ebooks.
5. Server Components por defecto; Client Components solo para interacción.

---

## 6. Modelo de datos v2

Se conserva el diseño actual (evaluado y correcto): `profiles` 1-a-1 con
`auth.users`, `items` como superclase con `ebooks`/`plans`, `orders`/
`order_details`, `appointments`, `features`/`plan_features`. Se aplican estos
ajustes:

### 6.1. Correcciones de seguridad

- **`profiles` — escalada de roles (crítico).** La policy actual permite al
  dueño actualizar cualquier columna, incluida `role`. Fix:
  ```sql
  REVOKE UPDATE ON public.profiles FROM authenticated;
  GRANT UPDATE (full_name, phone_number, email) ON public.profiles TO authenticated;
  ```
  El rol solo cambia por operación administrativa controlada.

### 6.2. Pagos QR

- `orders`:
  - `reference_code text NOT NULL UNIQUE` — código legible para la glosa, p. ej. `NW-4F7K2`, generado en servidor.
  - `paid_at timestamptz` — fecha de confirmación.
  - `verified_by uuid REFERENCES profiles(id)` — admin que confirmó.
- Nueva tabla `payment_proofs`:
  - `id`, `order_id`, `amount_declared`, `storage_path`, `uploaded_at`, `reviewed_at`, `reviewed_by`, `note`.
  - Imagen en bucket **privado** (`payment-proofs`), servida por URL firmada al admin.

### 6.3. Órdenes atómicas

- RPC `create_order(p_item_id uuid)` (SECURITY DEFINER con validación):
  1. Verifica sesión y que el ítem esté activo.
  2. Lee el precio real de `items` (ignora cualquier precio del cliente).
  3. Genera `reference_code` único.
  4. Inserta `orders` + `order_details` en **una transacción**.
  5. Devuelve el pedido.
- `fix_paid_price()` se mantiene como defensa en profundidad, pero el precio ya no depende de él.

### 6.4. Citas

- RLS de `INSERT` en `appointments`: el `order_detail_id` debe pertenecer al
  usuario **y** el ítem debe ser `item_type = 'plan'` **y** la orden debe estar
  `paid`.
- Índice único parcial: **1 cita activa por `order_detail_id`**
  (`status IN ('pending','confirmed')`).
- Constraint anti-solapamiento con `EXCLUDE USING gist (tstzrange(date_time, date_time + interval '1 hour') WITH &&)`
  (requiere `btree_gist`) — agenda de una sola profesional.
- Se elimina `CHECK (date_time > now())` (rompía transiciones como `completed`);
  la validación de fechas pasa a la lógica del servidor.
- RPC `create_appointment(p_order_detail_id, p_type_id, p_date_time, p_notes)`
  valida propiedad, tipo activo, fecha futura y solapamiento.

### 6.5. Descargas

- `ebooks.file_url` → `file_path text` (ruta dentro del bucket privado `ebooks`).
- Route Handler `GET /downloads/[itemId]`:
  1. Verifica sesión.
  2. Comprueba orden `paid` + `order_details` del usuario para ese ítem.
  3. Genera URL firmada (p. ej. 60 s) y redirige.
  4. Registra la descarga (opcional, sin datos innecesarios).

### 6.6. Catálogo

- Sin cambios estructurales. `items.status` controla visibilidad; RLS pública
  solo expone `status = true`.
- `items.created_by` se mantiene nullable (altas desde panel admin).

---

## 7. Flujos

1. **Compra:** catálogo → `create_order` → pantalla de pago con QR fijo + `reference_code` → cliente transfiere con el código en la glosa → sube comprobante → orden `pending`.
2. **Confirmación:** admin ve la cola (comprobante + monto + código) → contrasta con su banco → "Confirmar pago" (RPC/admin, set `paid`, `paid_at`, `verified_by`).
3. **Descarga:** usuario con orden pagada → `/downloads/[itemId]` → URL firmada.
4. **Cita:** usuario con plan pagado → elige tipo, fecha y hora → `create_appointment` (valida todo en servidor) → `pending` → admin confirma/completa/cancela.
5. **Admin:** CRUD catálogo, pagos, citas. Todas las rutas validan rol en servidor + RLS.

---

## 8. Etapas de implementación

1. ✅ **BD v2** — `supabase/schema.sql` reescrito y aplicado al proyecto Supabase
   (fix de roles, `payment_proofs`, `reference_code`, RPCs, reglas de citas,
   `file_path`, buckets privados con límite de tamaño y MIME).
2. ✅ **Infra** — clientes Supabase (server/browser), `mapDbError`, buckets
   privados, `.env.example` y README de despliegue.
3. ✅ **Compras y pagos** — `create_order`, `/pagar/[orderId]` con QR + código de
   referencia copiable + subida de comprobante a `payment-proofs`.
4. ✅ **Panel admin** — cola de pagos en `/dashboard/admin/pagos` con comprobante
   firmado y confirmación/cancelación en 1 clic. CRUD de catálogo existente.
5. ✅ **Citas** — formulario sobre las compras de plan pagadas, reglas en el
   trigger `validate_appointment` (equivalente a `create_appointment`) y
   cancelación desde el panel del paciente.
6. ✅ **Descargas** — `/downloads/[itemId]` verifica compra pagada y redirige a
   una URL firmada de 2 minutos.
7. ✅ **Dashboard paciente** — órdenes con estado y código, accesos a pago y
   descargas, citas con cancelación.
8. ⏳ **Cierre** — `tsc`, `lint` y `build` en verde; falta la prueba manual
   guiada con una cuenta real y el despliegue en Vercel.

> Nota: en la implementación, las reglas de citas viven en el trigger
> `validate_appointment` + RLS en lugar de una RPC `create_appointment`. El
> trigger se ejecuta en cualquier ruta de escritura, así que la garantía es
> equivalente (o mayor) y el formulario puede seguir insertando directo.

---

## 9. Criterios de aceptación

### Seguridad
- [ ] Un usuario no puede cambiar su `role` ni el de otro.
- [ ] Rutas admin verifican rol en servidor y RLS falla cerrado.
- [ ] Precios y estados de pago solo cambian desde operaciones autorizadas.
- [ ] Ebooks accesibles únicamente con compra pagada y URL temporal.
- [ ] Secretos solo en servidor; `service_role` ausente del cliente.

### Negocio
- [ ] Orden creada atómicamente con precio de servidor y `reference_code` único.
- [ ] Pago confirmado refleja `paid`, `paid_at` y `verified_by`.
- [ ] Cita imposible sin plan pagado; 1 cita activa por compra; sin solapamientos.
- [ ] Descarga denegada a usuarios sin compra o con orden `pending`.

### Calidad
- [ ] `typecheck`, `lint` y `build` sin errores.
- [ ] Flujos críticos probados manualmente: compra→pago→descarga, compra→cita, admin.
- [ ] Procedimiento de despliegue documentado.

---

## 10. Riesgos y pendientes

| Riesgo | Mitigación |
|---|---|
| Confirmación de pagos depende de revisión humana | Cola clara + comprobante + código único; automatizable luego con API bancaria |
| Sin API bancaria gratuita en Bolivia | Módulo de pagos desacoplado; preparado para webhook/consulta futura |
| Supabase Free (límites de Storage/DB) | Uso acotado: PDFs comprimidos, comprobantes pequeños, limpieza periódica |
| SQL destructivo en producción | Aplicar solo con respaldo/ventana de mantenimiento y aprobación explícita |
