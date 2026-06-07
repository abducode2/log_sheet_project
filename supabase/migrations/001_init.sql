-- ================================================================
--  P-179 MURCIA-2 ZONE 06  –  Supabase Database Migration
--  Run this in: Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (linked to auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  company     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 1. Shop Drawing Submittal ───────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_drawings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  request_no       TEXT,
  description      TEXT,
  submission_date  DATE,
  element          TEXT,
  rev              INTEGER DEFAULT 0,
  ac_co            TEXT CHECK (ac_co IN ('A','B','C','D','P')),
  approval_date    DATE,
  v_time           INTEGER,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Supplier Pre-Qualification ──────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_prequalifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  supplier_name    TEXT,
  trade            TEXT,
  submission_date  DATE,
  status           TEXT CHECK (status IN ('A','B','C','D','P')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Material Submittal ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_submittals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  request_no       TEXT,
  description      TEXT,
  submission_date  DATE,
  element          TEXT,
  rev              INTEGER DEFAULT 0,
  status           TEXT CHECK (status IN ('A','B','C','D','P')),
  approval_date    DATE,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Material Inspection Request ─────────────────────────────
CREATE TABLE IF NOT EXISTS material_inspection_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  mir_no           TEXT,
  description      TEXT,
  request_date     DATE,
  inspection_date  DATE,
  result           TEXT CHECK (result IN ('Pass','Fail','Pending')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Document Transmittal ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_transmittals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  transmittal_no   TEXT,
  subject          TEXT,
  date             DATE,
  from_party       TEXT,
  to_party         TEXT,
  no_of_copies     INTEGER DEFAULT 1,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Inspection Request ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  ir_no            TEXT,
  description      TEXT,
  location         TEXT,
  request_date     DATE,
  inspection_date  DATE,
  result           TEXT CHECK (result IN ('Approved','Rejected','Conditional','Pending')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Inspection Request for Unifier ──────────────────────────
CREATE TABLE IF NOT EXISTS inspection_requests_unifier (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  ir_no            TEXT,
  unifier_no       TEXT,
  description      TEXT,
  date             DATE,
  status           TEXT,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. CPR Unifier ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cpr_unifier (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  cpr_no           TEXT,
  unifier_no       TEXT,
  description      TEXT,
  date             DATE,
  status           TEXT,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. Concrete Pour Request ────────────────────────────────────
CREATE TABLE IF NOT EXISTS concrete_pour_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  cpr_no           TEXT,
  description      TEXT,
  location         TEXT,
  pour_date        DATE,
  volume_m3        NUMERIC(10,2),
  mix_design       TEXT,
  status           TEXT CHECK (status IN ('Approved','Rejected','Pending')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. Request for Information ─────────────────────────────────
CREATE TABLE IF NOT EXISTS requests_for_information (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  rfi_no           TEXT,
  subject          TEXT,
  question         TEXT,
  answer           TEXT,
  submission_date  DATE,
  response_date    DATE,
  status           TEXT CHECK (status IN ('Open','Closed','Pending')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. Non-Conformance Report ──────────────────────────────────
CREATE TABLE IF NOT EXISTS non_conformance_reports (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         TEXT NOT NULL DEFAULT 'M2P06',
  no                 INTEGER,
  ncr_no             TEXT,
  description        TEXT,
  location           TEXT,
  issue_date         DATE,
  close_date         DATE,
  status             TEXT CHECK (status IN ('Open','Closed')),
  corrective_action  TEXT,
  remarks            TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. Field Report / Site Observation ────────────────────────
CREATE TABLE IF NOT EXISTS field_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       TEXT NOT NULL DEFAULT 'M2P06',
  no               INTEGER,
  report_no        TEXT,
  subject          TEXT,
  date             DATE,
  inspector        TEXT,
  observations     TEXT,
  action_required  TEXT,
  status           TEXT CHECK (status IN ('Open','Closed')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. Rawaf → Naga Letters ────────────────────────────────────
CREATE TABLE IF NOT EXISTS letters_rawaf_naga (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  TEXT NOT NULL DEFAULT 'M2P06',
  no          INTEGER,
  letter_no   TEXT,
  subject     TEXT,
  date        DATE,
  remarks     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. Naga → Rawaf Letters ────────────────────────────────────
CREATE TABLE IF NOT EXISTS letters_naga_rawaf (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  TEXT NOT NULL DEFAULT 'M2P06',
  no          INTEGER,
  letter_no   TEXT,
  subject     TEXT,
  date        DATE,
  remarks     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
--  Row Level Security (RLS)
-- ================================================================
ALTER TABLE shop_drawings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prequalifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_submittals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_transmittals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests_unifier ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpr_unifier               ENABLE ROW LEVEL SECURITY;
ALTER TABLE concrete_pour_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests_for_information  ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_conformance_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters_rawaf_naga        ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters_naga_rawaf        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all data
CREATE POLICY "Authenticated can read" ON shop_drawings             FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON supplier_prequalifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON material_submittals       FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON material_inspection_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON document_transmittals     FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON inspection_requests       FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON inspection_requests_unifier FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON cpr_unifier               FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON concrete_pour_requests    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON requests_for_information  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON non_conformance_reports   FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON field_reports             FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON letters_rawaf_naga        FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read" ON letters_naga_rawaf        FOR SELECT TO authenticated USING (true);

-- Admins and editors can write
CREATE POLICY "Admin editor can insert" ON shop_drawings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "Admin editor can update" ON shop_drawings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "Admin editor can delete" ON shop_drawings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can read/update own profile
CREATE POLICY "Own profile" ON profiles FOR ALL TO authenticated USING (id = auth.uid());

-- ================================================================
--  Indexes for performance
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_shop_drawings_no     ON shop_drawings(no);
CREATE INDEX IF NOT EXISTS idx_shop_drawings_ac_co  ON shop_drawings(ac_co);
CREATE INDEX IF NOT EXISTS idx_shop_drawings_element ON shop_drawings(element);
CREATE INDEX IF NOT EXISTS idx_letters_rwf_nag_no   ON letters_rawaf_naga(no);
CREATE INDEX IF NOT EXISTS idx_letters_nag_rwf_no   ON letters_naga_rawaf(no);

-- ================================================================
--  Full-text search index
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_shop_drawings_fts ON shop_drawings
  USING GIN (to_tsvector('arabic', coalesce(description,'')));
