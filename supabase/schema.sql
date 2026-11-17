-- ====================================================================
-- ESQUEMA NutriWeb v2 — RESET TOTAL (sin migraciones)
-- Ejecutar en Supabase > SQL Editor (o vía MCP execute_sql)
--
-- Cambios v2 respecto a la versión anterior:
--   * profiles: el rol ya NO puede modificarse desde el cliente (grants por columna)
--   * orders: reference_code (glosa del QR), paid_at, verified_by
--   * payment_proofs: comprobantes subidos por el cliente
--   * RPC create_order: precio de servidor + orden/detalle atómicos
--   * RPC confirm_payment: confirmación de pago solo por admin
--   * appointments: solo con plan PAGADO, 1 activa por compra, anti-solapamiento
--   * ebooks.file_path + buckets privados (ebooks, payment-proofs)
-- ====================================================================

-- 0. Limpieza total (orden inverso por FKs)
DROP TABLE IF EXISTS public.settings, public.payment_proofs, public.appointments, public.appointment_types,
  public.order_details, public.orders, public.plan_features, public.features,
  public.ebooks, public.plans, public.items, public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_item_coherence() CASCADE;
DROP FUNCTION IF EXISTS public.fix_paid_price() CASCADE;
DROP FUNCTION IF EXISTS public.gen_reference_code() CASCADE;
DROP FUNCTION IF EXISTS public.create_order(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.confirm_payment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_order(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_appointment() CASCADE;

DROP TYPE IF EXISTS public.appointment_status, public.payment_method, public.item_type,
  public.user_role, public.order_status CASCADE;

DROP POLICY IF EXISTS "ebooks read paid owners" ON storage.objects;
DROP POLICY IF EXISTS "ebooks admin write" ON storage.objects;
DROP POLICY IF EXISTS "proofs insert own" ON storage.objects;
DROP POLICY IF EXISTS "proofs read own or admin" ON storage.objects;
DROP POLICY IF EXISTS "assets admin write" ON storage.objects;
-- Nota: los buckets no se borran porque Supabase bloquea DELETE directo en storage.buckets;
-- el upsert de la sección 12 los crea/actualiza.

-- 1. Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'patient');
CREATE TYPE public.item_type AS ENUM ('plan', 'ebook');
CREATE TYPE public.payment_method AS ENUM ('cash', 'transfer', 'card', 'qr', 'other');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'cancelled');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- 2. Código de referencia legible para la glosa del QR (ej. NW-4F7K2)
CREATE OR REPLACE FUNCTION public.gen_reference_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'NW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
$$;

-- 3. profiles (1-a-1 con auth.users)
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'patient',
    full_name text NOT NULL,
    email text NOT NULL,
    phone_number text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_email_uq ON public.profiles (lower(email));

-- 3.1 Ajustes del sitio (fila única): datos de cobro y QR subido desde el admin
CREATE TABLE public.settings (
    id boolean PRIMARY KEY DEFAULT true,
    qr_path text,
    bank_name text,
    account_holder text,
    account_number text,
    payment_note text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT settings_single_row CHECK (id)
);
INSERT INTO public.settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 4. Catálogo: superclase items + subclases ebooks / plans
CREATE TABLE public.items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type public.item_type NOT NULL,
    name text NOT NULL,
    description text,
    price decimal(10,2) NOT NULL CHECK (price >= 0),
    status boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_type_status_idx ON public.items (item_type, status);
CREATE INDEX items_created_by_idx ON public.items (created_by);

CREATE TABLE public.ebooks (
    id uuid PRIMARY KEY REFERENCES public.items (id) ON DELETE CASCADE,
    author text,
    -- ruta dentro del bucket privado "ebooks" (ej. "<item_id>/guia.pdf")
    file_path text
);

CREATE TABLE public.plans (
    id uuid PRIMARY KEY REFERENCES public.items (id) ON DELETE CASCADE,
    plan_duration_days integer CHECK (plan_duration_days IS NULL OR plan_duration_days > 0),
    plan_type text
);

-- 5. Features de planes
CREATE TABLE public.features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name text NOT NULL UNIQUE,
    description text
);

CREATE TABLE public.plan_features (
    plan_id uuid NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
    feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    PRIMARY KEY (plan_id, feature_id)
);

-- 6. Financiero maestro-detalle
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
    payment_method public.payment_method NOT NULL DEFAULT 'qr',
    status public.order_status NOT NULL DEFAULT 'pending',
    total_paid decimal(10,2) NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
    reference_code text NOT NULL UNIQUE DEFAULT public.gen_reference_code(),
    paid_at timestamptz,
    verified_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    cancellation_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_paid_consistency CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);
CREATE INDEX orders_user_idx ON public.orders (user_id);
CREATE INDEX orders_status_idx ON public.orders (status);

CREATE TABLE public.order_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    paid_price decimal(10,2) NOT NULL CHECK (paid_price >= 0),
    UNIQUE (order_id, item_id)
);
CREATE INDEX details_order_idx ON public.order_details (order_id);
CREATE INDEX details_item_idx ON public.order_details (item_id);

-- 7. Comprobantes de pago (bucket privado "payment-proofs")
CREATE TABLE public.payment_proofs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
    amount_declared decimal(10,2) NOT NULL CHECK (amount_declared >= 0),
    storage_path text NOT NULL,
    note text,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);
CREATE INDEX payment_proofs_order_idx ON public.payment_proofs (order_id);

-- 8. Citas
CREATE TABLE public.appointment_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name text NOT NULL UNIQUE,
    description text,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    order_detail_id uuid NOT NULL REFERENCES public.order_details (id) ON DELETE RESTRICT,
    appointment_type_id uuid NOT NULL REFERENCES public.appointment_types (id) ON DELETE RESTRICT,
    date_time timestamptz NOT NULL,
    status public.appointment_status NOT NULL DEFAULT 'pending',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appt_user_time_idx ON public.appointments (user_id, date_time);
CREATE INDEX appt_detail_idx ON public.appointments (order_detail_id);
CREATE INDEX appt_type_idx ON public.appointments (appointment_type_id);
CREATE INDEX appt_time_idx ON public.appointments (date_time);
-- 1 cita activa por compra
CREATE UNIQUE INDEX appt_one_active_per_detail ON public.appointments (order_detail_id)
    WHERE status IN ('pending', 'confirmed');

-- 9. Triggers y helpers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Coherencia superclase/subclase
CREATE OR REPLACE FUNCTION public.check_item_coherence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE c int;
BEGIN
    IF TG_TABLE_NAME = 'ebooks' THEN
        SELECT COUNT(*) INTO c FROM public.items WHERE id = NEW.id AND item_type = 'ebook';
        IF c = 0 THEN RAISE EXCEPTION 'items % no es tipo ebook', NEW.id; END IF;
    ELSIF TG_TABLE_NAME = 'plans' THEN
        SELECT COUNT(*) INTO c FROM public.items WHERE id = NEW.id AND item_type = 'plan';
        IF c = 0 THEN RAISE EXCEPTION 'items % no es tipo plan', NEW.id; END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ebooks_coh BEFORE INSERT OR UPDATE ON public.ebooks
    FOR EACH ROW EXECUTE FUNCTION public.check_item_coherence();
CREATE TRIGGER trg_plans_coh BEFORE INSERT OR UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION public.check_item_coherence();

-- Precio histórico: si llega 0/NULL se fija desde items (defensa en profundidad)
CREATE OR REPLACE FUNCTION public.fix_paid_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.paid_price IS NULL OR NEW.paid_price = 0 THEN
        SELECT price INTO NEW.paid_price FROM public.items WHERE id = NEW.item_id;
        IF NEW.paid_price IS NULL THEN RAISE EXCEPTION 'item % no existe', NEW.item_id; END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fix_price BEFORE INSERT ON public.order_details
    FOR EACH ROW EXECUTE FUNCTION public.fix_paid_price();

-- Helper admin sin recursión RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Validación de citas (defensa en profundidad, aplica a cualquier ruta de escritura)
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_admin boolean := public.is_admin();
    v_plan_ok boolean;
    v_overlap int;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF v_uid IS NOT NULL AND NOT v_admin THEN
            NEW.user_id := v_uid;
        END IF;
        IF NEW.status <> 'pending' AND NOT v_admin THEN
            NEW.status := 'pending';
        END IF;
    ELSE
        IF v_uid IS NOT NULL AND NOT v_admin THEN
            NEW.user_id := OLD.user_id;
            NEW.order_detail_id := OLD.order_detail_id;
            NEW.appointment_type_id := OLD.appointment_type_id;
            IF NEW.status NOT IN ('pending', 'cancelled') THEN
                RAISE EXCEPTION 'Estado de cita no permitido';
            END IF;
        END IF;
    END IF;

    -- La cita exige un PLAN PAGADO del mismo usuario
    SELECT EXISTS (
        SELECT 1
        FROM public.order_details d
        JOIN public.orders o ON o.id = d.order_id
        JOIN public.items i ON i.id = d.item_id
        WHERE d.id = NEW.order_detail_id
          AND o.user_id = NEW.user_id
          AND o.status = 'paid'
          AND i.item_type = 'plan'
    ) INTO v_plan_ok;

    IF NOT COALESCE(v_plan_ok, false) THEN
        RAISE EXCEPTION 'La cita requiere un plan pagado del mismo usuario';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.appointment_types t
        WHERE t.id = NEW.appointment_type_id AND t.is_active
    ) THEN
        RAISE EXCEPTION 'Tipo de cita no disponible';
    END IF;

    IF NEW.status IN ('pending', 'confirmed') THEN
        IF NEW.date_time <= now() THEN
            RAISE EXCEPTION 'La fecha de la cita debe ser futura';
        END IF;

        -- Serializa por franja de 1 hora: evita carreras entre solicitudes concurrentes
        PERFORM pg_advisory_xact_lock(
            hashtext('nutriweb-slot-' || floor(extract(epoch FROM NEW.date_time) / 3600)::text)
        );

        SELECT count(*) INTO v_overlap
        FROM public.appointments a
        WHERE a.id <> NEW.id
          AND a.status IN ('pending', 'confirmed')
          AND tstzrange(a.date_time, a.date_time + interval '1 hour')
              && tstzrange(NEW.date_time, NEW.date_time + interval '1 hour');

        IF v_overlap > 0 THEN
            RAISE EXCEPTION 'Ese horario ya está reservado';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_appt BEFORE INSERT OR UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.validate_appointment();

-- RPC: crear orden atómica con precio de servidor
CREATE OR REPLACE FUNCTION public.create_order(p_item_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_item public.items;
    v_order public.orders;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para comprar';
    END IF;

    SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
    IF NOT FOUND OR v_item.status IS NOT TRUE THEN
        RAISE EXCEPTION 'Producto no disponible';
    END IF;

    INSERT INTO public.orders (user_id, payment_method, status, total_paid)
    VALUES (v_user, 'qr', 'pending', v_item.price)
    RETURNING * INTO v_order;

    INSERT INTO public.order_details (order_id, item_id, paid_price)
    VALUES (v_order.id, v_item.id, v_item.price);

    RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.create_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order(uuid) TO authenticated;

-- RPC: confirmar pago (solo admin)
CREATE OR REPLACE FUNCTION public.confirm_payment(p_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.orders
       SET status = 'paid', paid_at = now(), verified_by = auth.uid()
     WHERE id = p_order_id AND status = 'pending'
     RETURNING * INTO v_order;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden inexistente o ya procesada';
    END IF;

    UPDATE public.payment_proofs
       SET reviewed_at = now(), reviewed_by = auth.uid()
     WHERE order_id = p_order_id AND reviewed_at IS NULL;

    RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_payment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid) TO authenticated;

-- RPC: cancelar orden pendiente (dueño o admin). Guarda quién y por qué.
CREATE OR REPLACE FUNCTION public.cancel_order(
    p_order_id uuid,
    p_reason text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_admin boolean := public.is_admin();
    v_order public.orders;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    UPDATE public.orders
       SET status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = v_uid,
           cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
     WHERE id = p_order_id
       AND status = 'pending'
       AND (user_id = v_uid OR v_admin)
     RETURNING * INTO v_order;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden inexistente o ya procesada';
    END IF;

    -- Historial: los comprobantes quedan marcados como revisados.
    UPDATE public.payment_proofs
       SET reviewed_at = coalesce(reviewed_at, now()),
           reviewed_by = coalesce(reviewed_by, v_uid)
     WHERE order_id = p_order_id;

    RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;

-- RPC: cancelar cita (dueño o admin)
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_id uuid)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_appt public.appointments;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    UPDATE public.appointments
       SET status = 'cancelled'
     WHERE id = p_id
       AND status IN ('pending', 'confirmed')
       AND (user_id = auth.uid() OR public.is_admin())
     RETURNING * INTO v_appt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cita inexistente o no cancelable';
    END IF;

    RETURN v_appt;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid) TO authenticated;

-- 10. RLS (deny by default)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- profiles: lectura propia + admin; el UPDATE se limita por grants de columna
CREATE POLICY "read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

-- settings: lectura pública (datos de cobro), escritura solo admin
CREATE POLICY "public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "admin write settings" ON public.settings FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- items: lectura pública solo activos + admin total
CREATE POLICY "public read items" ON public.items FOR SELECT USING (status = true);
CREATE POLICY "admin all items" ON public.items FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ebooks/plans: lectura pública solo si el item padre está activo
CREATE POLICY "public read ebooks" ON public.ebooks FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.items i WHERE i.id = ebooks.id AND i.status = true));
CREATE POLICY "admin all ebooks" ON public.ebooks FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "public read plans" ON public.plans FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.items i WHERE i.id = plans.id AND i.status = true));
CREATE POLICY "admin all plans" ON public.plans FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- catálogos públicos
CREATE POLICY "public read features" ON public.features FOR SELECT USING (true);
CREATE POLICY "admin all features" ON public.features FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "public read plan_features" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "admin all plan_features" ON public.plan_features FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "public read appt_types" ON public.appointment_types FOR SELECT USING (is_active = true);
CREATE POLICY "admin all appt_types" ON public.appointment_types FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- orders: lectura propia + admin. SIN INSERT directo: solo la RPC create_order
CREATE POLICY "own read orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admin all orders" ON public.orders FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- order_details: lectura propia + admin. SIN INSERT directo: solo la RPC create_order
CREATE POLICY "own read details" ON public.order_details FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_details.order_id AND o.user_id = auth.uid()));
CREATE POLICY "admin all details" ON public.order_details FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- payment_proofs: dueño de la orden + admin
CREATE POLICY "own read proofs" ON public.payment_proofs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payment_proofs.order_id AND o.user_id = auth.uid()));
CREATE POLICY "own insert proofs" ON public.payment_proofs FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = payment_proofs.order_id AND o.user_id = auth.uid() AND o.status = 'pending'
    ));
CREATE POLICY "admin all proofs" ON public.payment_proofs FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- appointments: dueño + admin. El trigger validate_appointment aplica las reglas de negocio
CREATE POLICY "own read appts" ON public.appointments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert appts" ON public.appointments FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1
            FROM public.order_details d
            JOIN public.orders o ON o.id = d.order_id
            JOIN public.items i ON i.id = d.item_id
            WHERE d.id = order_detail_id
              AND o.user_id = auth.uid()
              AND o.status = 'paid'
              AND i.item_type = 'plan'
        )
    );
CREATE POLICY "own update appts" ON public.appointments FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin all appts" ON public.appointments FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 11. Privilegios
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- El rol solo se cambia por operación administrativa (no por el cliente)
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone_number) ON public.profiles TO authenticated;

-- 12. Storage: buckets privados + policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assets', 'assets', true, 2097152,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ebooks', 'ebooks', false, 26214400,
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs', 'payment-proofs', false, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ebooks: solo dueños con compra pagada (o admin) pueden leer/generar URL firmada
CREATE POLICY "ebooks read paid owners" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'ebooks'
    AND (
        public.is_admin()
        OR EXISTS (
            SELECT 1
            FROM public.order_details d
            JOIN public.orders o ON o.id = d.order_id
            WHERE d.item_id::text = (storage.foldername(name))[1]
              AND o.user_id = auth.uid()
              AND o.status = 'paid'
        )
    )
);

CREATE POLICY "ebooks admin write" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'ebooks' AND public.is_admin())
WITH CHECK (bucket_id = 'ebooks' AND public.is_admin());

-- payment-proofs: el cliente sube/lee solo los de sus órdenes pendientes; admin todo
CREATE POLICY "proofs insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id::text = (storage.foldername(name))[1]
          AND o.user_id = auth.uid()
          AND o.status = 'pending'
    )
);

CREATE POLICY "proofs read own or admin" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'payment-proofs'
    AND (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id::text = (storage.foldername(name))[1]
              AND o.user_id = auth.uid()
        )
    )
);

-- assets: bucket público para imágenes del sitio; solo el admin escribe
CREATE POLICY "assets admin write" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'assets' AND public.is_admin())
WITH CHECK (bucket_id = 'assets' AND public.is_admin());

-- 13. Seeds
INSERT INTO public.appointment_types (type_name, description) VALUES
    ('Presencial', 'Consulta en consultorio'),
    ('Online', 'Videollamada')
ON CONFLICT (type_name) DO NOTHING;

INSERT INTO public.features (feature_name, description) VALUES
    ('Plan personalizado', 'Menú adaptado a horarios y preferencias'),
    ('Seguimiento WhatsApp', 'Resolución de dudas por chat'),
    ('Ajuste quincenal', 'Revisión del menú cada 15 días'),
    ('Guía eBook', 'Material educativo incluido')
ON CONFLICT (feature_name) DO NOTHING;

-- Recrea el perfil de los usuarios ya existentes en auth.users.
-- El correo del dueño queda como admin; cualquier otro usuario nuevo será patient.
INSERT INTO public.profiles (id, role, full_name, email)
SELECT
    u.id,
    CASE WHEN lower(u.email) = 'froluxen@gmail.com' THEN 'admin'::public.user_role
         ELSE 'patient'::public.user_role END,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.email
FROM auth.users u
ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
