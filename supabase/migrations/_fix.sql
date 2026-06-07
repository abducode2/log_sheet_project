-- ================================================================
--  خطوة 1: احذف كل شيء قديم أولاً
-- ================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS shop_drawings CASCADE;
DROP TABLE IF EXISTS supplier_prequalifications CASCADE;
DROP TABLE IF EXISTS material_submittals CASCADE;
DROP TABLE IF EXISTS material_inspection_requests CASCADE;
DROP TABLE IF EXISTS document_transmittals CASCADE;
DROP TABLE IF EXISTS inspection_requests CASCADE;
DROP TABLE IF EXISTS inspection_requests_unifier CASCADE;
DROP TABLE IF EXISTS cpr_unifier CASCADE;
DROP TABLE IF EXISTS concrete_pour_requests CASCADE;
DROP TABLE IF EXISTS requests_for_information CASCADE;
DROP TABLE IF EXISTS non_conformance_reports CASCADE;
DROP TABLE IF EXISTS field_reports CASCADE;
DROP TABLE IF EXISTS letters_rawaf_naga CASCADE;
DROP TABLE IF EXISTS letters_naga_rawaf CASCADE;

-- ================================================================
--  خطوة 2: أنشئ الجداول (بدون trigger معقّد)
-- ================================================================

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  role       TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shop_drawings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  request_no      TEXT,
  description     TEXT,
  submission_date DATE,
  element         TEXT,
  rev             INTEGER DEFAULT 0,
  ac_co           TEXT,
  approval_date   DATE,
  v_time          INTEGER,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE material_submittals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  request_no      TEXT,
  description     TEXT,
  submission_date DATE,
  element         TEXT,
  rev             INTEGER DEFAULT 0,
  status          TEXT,
  approval_date   DATE,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supplier_prequalifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  supplier_name   TEXT,
  trade           TEXT,
  submission_date DATE,
  status          TEXT,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE material_inspection_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  mir_no          TEXT,
  description     TEXT,
  request_date    DATE,
  inspection_date DATE,
  result          TEXT,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_transmittals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  transmittal_no  TEXT,
  subject         TEXT,
  date            DATE,
  from_party      TEXT,
  to_party        TEXT,
  no_of_copies    INTEGER DEFAULT 1,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspection_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  ir_no           TEXT,
  description     TEXT,
  location        TEXT,
  request_date    DATE,
  inspection_date DATE,
  result          TEXT,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspection_requests_unifier (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no          INTEGER,
  ir_no       TEXT,
  unifier_no  TEXT,
  description TEXT,
  date        DATE,
  status      TEXT,
  remarks     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cpr_unifier (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no          INTEGER,
  cpr_no      TEXT,
  unifier_no  TEXT,
  description TEXT,
  date        DATE,
  status      TEXT,
  remarks     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE concrete_pour_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no          INTEGER,
  cpr_no      TEXT,
  description TEXT,
  location    TEXT,
  pour_date   DATE,
  volume_m3   NUMERIC(10,2),
  mix_design  TEXT,
  status      TEXT,
  remarks     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE requests_for_information (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  rfi_no          TEXT,
  subject         TEXT,
  question        TEXT,
  answer          TEXT,
  submission_date DATE,
  response_date   DATE,
  status          TEXT,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE non_conformance_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no                INTEGER,
  ncr_no            TEXT,
  description       TEXT,
  location          TEXT,
  issue_date        DATE,
  close_date        DATE,
  status            TEXT,
  corrective_action TEXT,
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE field_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no              INTEGER,
  report_no       TEXT,
  subject         TEXT,
  date            DATE,
  inspector       TEXT,
  observations    TEXT,
  action_required TEXT,
  status          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE letters_rawaf_naga (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no         INTEGER,
  letter_no  TEXT,
  subject    TEXT,
  date       DATE,
  remarks    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE letters_naga_rawaf (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no         INTEGER,
  letter_no  TEXT,
  subject    TEXT,
  date       DATE,
  remarks    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
--  خطوة 3: RLS - السماح لأي مستخدم مسجّل بالقراءة والكتابة
-- ================================================================
ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_drawings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_submittals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prequalifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_transmittals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests_unifier ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpr_unifier                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE concrete_pour_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests_for_information    ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_conformance_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters_rawaf_naga          ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters_naga_rawaf          ENABLE ROW LEVEL SECURITY;

-- سياسة واحدة بسيطة: أي مستخدم مسجّل يقرأ ويكتب
CREATE POLICY "auth_all" ON profiles                    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON shop_drawings               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON material_submittals         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON supplier_prequalifications  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON material_inspection_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON document_transmittals       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON inspection_requests         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON inspection_requests_unifier FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON cpr_unifier                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON concrete_pour_requests      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON requests_for_information    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON non_conformance_reports     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON field_reports               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON letters_rawaf_naga          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON letters_naga_rawaf          FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
--  خطوة 4: Trigger بسيط وآمن لإنشاء الـ profile
-- ================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'admin')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();