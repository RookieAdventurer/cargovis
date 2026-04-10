-- ============================================================
--  Container Tracker — Supabase Schema
--  Run this entire file once in Supabase SQL Editor
--  Project: qkyjlggmirnbgagkdgch.supabase.co
-- ============================================================


-- ── 1. SUPPLIERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,              -- e.g. 'POLAND', 'HOSANNA'
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#1F3864',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

-- Seed default suppliers
INSERT INTO suppliers (id, name, color, notes) VALUES
  ('POLAND',  'Poland',  '#1F3864', 'Main clothing supplier'),
  ('HOSANNA', 'Hosanna', '#276749', ''),
  ('TEX',     'TEX',     '#C27D10', ''),
  ('OFTEX',   'OFTEX',   '#C53030', 'CMA CGM primarily')
ON CONFLICT (id) DO NOTHING;


-- ── 2. CONTAINERS (active) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS containers (
  id            BIGSERIAL PRIMARY KEY,
  container_no  TEXT NOT NULL UNIQUE,
  vessel        TEXT,
  eta           DATE,
  line          TEXT,                        -- Maersk, Hapag-Lloyd, CMA CGM, MSC
  recipient     TEXT DEFAULT 'WAGYINGO',
  supplier_id   TEXT REFERENCES suppliers(id),
  packing_list  JSONB,                       -- { name, size, path, uploaded }
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID REFERENCES auth.users(id)
);

-- Index for fast supplier filtering
CREATE INDEX IF NOT EXISTS idx_containers_supplier ON containers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_containers_eta      ON containers(eta);


-- ── 3. ARCHIVE (emptied containers) ──────────────────────────
CREATE TABLE IF NOT EXISTS archive (
  id            BIGSERIAL PRIMARY KEY,
  container_no  TEXT NOT NULL,
  vessel        TEXT,
  eta           DATE,
  line          TEXT,
  recipient     TEXT,
  supplier_id   TEXT REFERENCES suppliers(id),
  packing_list  JSONB,
  emptied_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  emptied_by    UUID REFERENCES auth.users(id),
  original_id   BIGINT,                      -- original containers.id for reference
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_supplier   ON archive(supplier_id);
CREATE INDEX IF NOT EXISTS idx_archive_emptied_on ON archive(emptied_on DESC);


-- ── 4. USER ROLES ─────────────────────────────────────────────
-- Stores role for each user: 'admin', 'editor', 'viewer'
-- admin  = you (full access + manage suppliers)
-- editor = secretary (full access except manage suppliers)
-- viewer = boss (read + export only)
CREATE TABLE IF NOT EXISTS user_roles (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  full_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ── 5. AUTO-UPDATE updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON containers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 6. ROW LEVEL SECURITY ─────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE suppliers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles  ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;


-- ── SUPPLIERS policies ────────────────────────────────────────
-- Everyone can read
CREATE POLICY "suppliers_read" ON suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can insert/update/delete
CREATE POLICY "suppliers_write" ON suppliers
  FOR ALL USING (get_my_role() = 'admin');


-- ── CONTAINERS policies ───────────────────────────────────────
-- Everyone logged in can read
CREATE POLICY "containers_read" ON containers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin and editor can insert
CREATE POLICY "containers_insert" ON containers
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'editor'));

-- Admin and editor can update
CREATE POLICY "containers_update" ON containers
  FOR UPDATE USING (get_my_role() IN ('admin', 'editor'));

-- Admin and editor can delete
CREATE POLICY "containers_delete" ON containers
  FOR DELETE USING (get_my_role() IN ('admin', 'editor'));


-- ── ARCHIVE policies ──────────────────────────────────────────
-- Everyone logged in can read
CREATE POLICY "archive_read" ON archive
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin and editor can insert (move to archive)
CREATE POLICY "archive_insert" ON archive
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'editor'));

-- Only admin can delete from archive
CREATE POLICY "archive_delete" ON archive
  FOR DELETE USING (get_my_role() = 'admin');


-- ── USER ROLES policies ───────────────────────────────────────
-- Users can read their own role
CREATE POLICY "roles_read_own" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Only admin can manage roles
CREATE POLICY "roles_admin" ON user_roles
  FOR ALL USING (get_my_role() = 'admin');


-- ── 7. STORAGE BUCKET (packing lists) ────────────────────────
-- Run this to create a private bucket for packing list files
INSERT INTO storage.buckets (id, name, public)
VALUES ('packing-lists', 'packing-lists', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload
CREATE POLICY "pl_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'packing-lists' AND
    auth.uid() IS NOT NULL AND
    get_my_role() IN ('admin', 'editor')
  );

-- Storage policy: authenticated users can read
CREATE POLICY "pl_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'packing-lists' AND
    auth.uid() IS NOT NULL
  );

-- Storage policy: admin and editor can delete
CREATE POLICY "pl_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'packing-lists' AND
    get_my_role() IN ('admin', 'editor')
  );


-- ============================================================
--  DONE. Your database is ready.
--  Next: create your 3 users in Supabase Auth, then run
--  the INSERT below for each user with their UUID and role.
--
--  INSERT INTO user_roles (user_id, role, full_name) VALUES
--    ('your-uuid-here', 'admin',  'Your Name'),
--    ('your-uuid-here', 'editor', 'Secretary Name'),
--    ('your-uuid-here', 'viewer', 'Boss Name');
-- ============================================================
