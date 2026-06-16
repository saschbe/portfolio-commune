-- ============================================================
-- Migration : public_tables_rls
-- Date      : 2026-06-16
-- Objet     : Politiques RLS pour les tables metier sensibles
--             + alignement du bucket photos-originals avec
--             l'upload utilisateur actuel.
-- ============================================================

-- Helpers de role centralises.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'admin'
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin_or_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('admin', 'moderator')
$$;

-- Empêche un utilisateur de s'auto-promouvoir via une requete client
-- directe sur profiles. Les admins gardent le droit de changer les roles.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NULL THEN
    NEW.role := 'user';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() = NEW.id
       AND NEW.role <> 'user'
       AND NOT public.current_user_is_admin() THEN
      RAISE EXCEPTION 'Only admins can assign privileged roles';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND NOT public.current_user_is_admin() THEN
      RAISE EXCEPTION 'Only admins can change roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role_trigger ON public.profiles;
CREATE TRIGGER protect_profile_role_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.current_user_is_admin())
  WITH CHECK (id = auth.uid() OR public.current_user_is_admin());

-- ============================================================
-- photos
-- ============================================================
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_select_public_owner_or_staff" ON public.photos;
CREATE POLICY "photos_select_public_owner_or_staff"
  ON public.photos
  FOR SELECT
  USING (
    status = 'approved'
    OR status IS NULL
    OR user_id = auth.uid()
    OR public.current_user_is_admin_or_moderator()
  );

DROP POLICY IF EXISTS "photos_insert_owner_or_staff" ON public.photos;
CREATE POLICY "photos_insert_owner_or_staff"
  ON public.photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_is_admin_or_moderator()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "photos_update_staff" ON public.photos;
CREATE POLICY "photos_update_staff"
  ON public.photos
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator())
  WITH CHECK (public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "photos_delete_staff" ON public.photos;
CREATE POLICY "photos_delete_staff"
  ON public.photos
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator());

-- ============================================================
-- lieux
-- ============================================================
ALTER TABLE public.lieux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lieux_public_read" ON public.lieux;
CREATE POLICY "lieux_public_read"
  ON public.lieux
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "lieux_write_staff" ON public.lieux;
CREATE POLICY "lieux_write_staff"
  ON public.lieux
  FOR ALL
  TO authenticated
  USING (public.current_user_is_admin_or_moderator())
  WITH CHECK (public.current_user_is_admin_or_moderator());

-- ============================================================
-- filtres_categories
-- ============================================================
ALTER TABLE public.filtres_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "filtres_categories_public_read" ON public.filtres_categories;
CREATE POLICY "filtres_categories_public_read"
  ON public.filtres_categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "filtres_categories_write_staff" ON public.filtres_categories;
CREATE POLICY "filtres_categories_write_staff"
  ON public.filtres_categories
  FOR ALL
  TO authenticated
  USING (public.current_user_is_admin_or_moderator())
  WITH CHECK (public.current_user_is_admin_or_moderator());

-- ============================================================
-- signalements
-- ============================================================
ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signalements_select_own_or_staff" ON public.signalements;
CREATE POLICY "signalements_select_own_or_staff"
  ON public.signalements
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "signalements_insert_own" ON public.signalements;
CREATE POLICY "signalements_insert_own"
  ON public.signalements
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "signalements_update_staff" ON public.signalements;
CREATE POLICY "signalements_update_staff"
  ON public.signalements
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator())
  WITH CHECK (public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "signalements_delete_staff" ON public.signalements;
CREATE POLICY "signalements_delete_staff"
  ON public.signalements
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator());

-- ============================================================
-- temoignages
-- ============================================================
ALTER TABLE public.temoignages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temoignages_select_visible_owner_or_staff" ON public.temoignages;
CREATE POLICY "temoignages_select_visible_owner_or_staff"
  ON public.temoignages
  FOR SELECT
  USING (
    status = 'visible'
    OR author_id = auth.uid()
    OR public.current_user_is_admin_or_moderator()
  );

DROP POLICY IF EXISTS "temoignages_insert_own" ON public.temoignages;
CREATE POLICY "temoignages_insert_own"
  ON public.temoignages
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "temoignages_update_staff" ON public.temoignages;
CREATE POLICY "temoignages_update_staff"
  ON public.temoignages
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator())
  WITH CHECK (public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "temoignages_delete_owner_or_staff" ON public.temoignages;
CREATE POLICY "temoignages_delete_owner_or_staff"
  ON public.temoignages
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.current_user_is_admin_or_moderator());

-- ============================================================
-- signalements_temoignages
-- ============================================================
ALTER TABLE public.signalements_temoignages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signalements_temoignages_select_own_or_staff" ON public.signalements_temoignages;
CREATE POLICY "signalements_temoignages_select_own_or_staff"
  ON public.signalements_temoignages
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "signalements_temoignages_insert_own" ON public.signalements_temoignages;
CREATE POLICY "signalements_temoignages_insert_own"
  ON public.signalements_temoignages
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "signalements_temoignages_update_staff" ON public.signalements_temoignages;
CREATE POLICY "signalements_temoignages_update_staff"
  ON public.signalements_temoignages
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator())
  WITH CHECK (public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "signalements_temoignages_delete_staff" ON public.signalements_temoignages;
CREATE POLICY "signalements_temoignages_delete_staff"
  ON public.signalements_temoignages
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin_or_moderator());

-- ============================================================
-- activites
-- ============================================================
ALTER TABLE public.activites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activites_select_staff" ON public.activites;
CREATE POLICY "activites_select_staff"
  ON public.activites
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin_or_moderator());

DROP POLICY IF EXISTS "activites_insert_authenticated" ON public.activites;
CREATE POLICY "activites_insert_authenticated"
  ON public.activites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- Storage alignment: photos-originals
-- ============================================================
DROP POLICY IF EXISTS "originals_authenticated_insert" ON storage.objects;
CREATE POLICY "originals_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos-originals');
