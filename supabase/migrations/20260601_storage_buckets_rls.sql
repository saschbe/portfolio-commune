-- ============================================================
-- Migration : storage_buckets_rls
-- Date      : 2026-06-01
-- Objet     : Création du bucket photos-originals (privé) +
--             politiques RLS sur storage.objects pour les deux
--             buckets photos et photos-originals.
-- ============================================================


-- ── BUCKET : photos (existant) ──────────────────────────────
-- S'assurer que le bucket est public (accès direct aux URLs).
-- Les sous-dossiers thumb/, medium/, full/ sont des conventions
-- de nommage appliquées côté application lors de l'upload ;
-- ils ne nécessitent pas d'entrée SQL.
UPDATE storage.buckets
SET    public = true
WHERE  id = 'photos';


-- ── BUCKET : photos-originals (nouveau, privé) ──────────────
-- Stocke les fichiers originaux avant traitement.
-- Jamais accessible publiquement — lecture réservée aux admins
-- et modérateurs, écriture réservée au service role (Edge Functions).
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos-originals', 'photos-originals', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- ============================================================
-- POLITIQUES RLS — BUCKET "photos"
-- Lecture publique · Écriture authentifiée · Suppression admin/mod
-- ============================================================

-- SELECT : tout le monde, y compris les visiteurs non connectés.
DROP POLICY IF EXISTS "photos_public_read" ON storage.objects;
CREATE POLICY "photos_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'photos');

-- INSERT : tout utilisateur authentifié peut uploader dans photos/.
-- (la validation du contenu se fait en amont dans l'application)
DROP POLICY IF EXISTS "photos_authenticated_insert" ON storage.objects;
CREATE POLICY "photos_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

-- UPDATE : réservé aux admins et modérateurs.
-- Permet de remplacer un fichier existant (ex. version recadrée).
DROP POLICY IF EXISTS "photos_admin_mod_update" ON storage.objects;
CREATE POLICY "photos_admin_mod_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1
      FROM   public.profiles
      WHERE  id   = auth.uid()
        AND  role IN ('admin', 'moderator')
    )
  );

-- DELETE : réservé aux admins et modérateurs.
-- Un contributeur lambda ne peut pas supprimer les fichiers.
DROP POLICY IF EXISTS "photos_admin_mod_delete" ON storage.objects;
CREATE POLICY "photos_admin_mod_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1
      FROM   public.profiles
      WHERE  id   = auth.uid()
        AND  role IN ('admin', 'moderator')
    )
  );


-- ============================================================
-- POLITIQUES RLS — BUCKET "photos-originals"
-- SELECT admin/mod uniquement · INSERT/DELETE service role uniquement
-- ============================================================

-- SELECT : admins et modérateurs uniquement.
-- Permet de consulter ou télécharger les originaux depuis l'admin.
DROP POLICY IF EXISTS "originals_admin_mod_read" ON storage.objects;
CREATE POLICY "originals_admin_mod_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'photos-originals'
    AND EXISTS (
      SELECT 1
      FROM   public.profiles
      WHERE  id   = auth.uid()
        AND  role IN ('admin', 'moderator')
    )
  );

-- INSERT / DELETE : service role uniquement.
-- Le service role contourne le RLS par conception dans Supabase.
-- L'ABSENCE de politique INSERT et DELETE sur ce bucket garantit
-- qu'aucun utilisateur authentifié (même admin) ne peut écrire
-- ou supprimer directement — seules les Edge Functions qui
-- utilisent la clé service_role le peuvent.
