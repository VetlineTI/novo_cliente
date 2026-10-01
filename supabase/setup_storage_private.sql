-- ==============================================================================
-- Script de Configuração de Segurança: Bucket 'novos_clientes' Privado com RLS
-- ==============================================================================
-- Este script torna o bucket 'novos_clientes' privado e configura as políticas
-- de acesso no Supabase Storage para garantir conformidade total com a LGPD:
-- 1. UPLOAD (INSERT): Liberado para 'anon' e 'authenticated' (formulário de novos clientes)
-- 2. LEITURA (SELECT): Restrito para usuários autenticados (Admin e cliente autenticado)
-- 3. GERAÇÃO DE SIGNED URL: Permitida para usuários autenticados
-- ==============================================================================

-- 1. Cria ou atualiza o bucket 'novos_clientes' definindo como PRIVADO (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'novos_clientes',
    'novos_clientes',
    false, -- BUCKET PRIVADO
    52428800, -- Limite de 50MB por arquivo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf', 'text/html', 'text/plain']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf', 'text/html', 'text/plain'];

-- 2. Remove políticas anteriores do bucket 'novos_clientes' para evitar duplicações
DROP POLICY IF EXISTS "Permitir upload publico novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura autenticada novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura publica novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update autenticado novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delete autenticado novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_auth_delete" ON storage.objects;

-- 3. POLÍTICA DE UPLOAD (INSERT):
-- Permite que qualquer pessoa (anon/public) envie documentos no cadastro de novos clientes
CREATE POLICY "novos_clientes_public_insert"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'novos_clientes');

-- 4. POLÍTICA DE LEITURA (SELECT):
-- Permite que apenas usuários autenticados (Admin / Cliente logado) leiam os arquivos e gerem Signed URLs
CREATE POLICY "novos_clientes_auth_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'novos_clientes');

-- 5. POLÍTICA DE ATUALIZAÇÃO (UPDATE):
CREATE POLICY "novos_clientes_auth_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'novos_clientes')
WITH CHECK (bucket_id = 'novos_clientes');

-- 6. POLÍTICA DE EXCLUSÃO (DELETE):
CREATE POLICY "novos_clientes_auth_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'novos_clientes');
