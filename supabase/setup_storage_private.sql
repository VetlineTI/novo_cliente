-- ==============================================================================
-- BLINDAGEM DEFINITIVA DO SUPABASE STORAGE: Bucket 'novos_clientes' (LGPD)
-- ==============================================================================
-- 1. Torna o bucket 'novos_clientes' estritamente PRIVADO (public = false)
-- 2. Elimina a política que permitia leitura pública para 'anon'
-- 3. Elimina as políticas que permitiam a qualquer cliente logado ver/deletar arquivos de outros
-- 4. Restringe LEITURA (SELECT) apenas a administradores ou ao próprio titular do CNPJ/CPF
-- 5. Restringe EXCLUSÃO (DELETE) e ALTERAÇÃO (UPDATE) exclusivamente a administradores
-- 6. Mantém UPLOAD (INSERT) público para permitir o envio do formulário de novos clientes
-- ==============================================================================

-- 1. Garante que o bucket 'novos_clientes' é PRIVADO
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'novos_clientes',
    'novos_clientes',
    false, -- BUCKET PRIVADO (Bloqueia acesso direto por URL pública)
    52428800, -- Limite de 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- 2. Remove TODAS as políticas antigas ou vulneráveis do bucket
DROP POLICY IF EXISTS "Permitir upload publico em novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir visualizacao em novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload publico novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura autenticada novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura publica novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update autenticado novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delete autenticado novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_storage_delete" ON storage.objects;

-- 3. POLÍTICA DE UPLOAD (INSERT):
-- Visitantes e clientes podem fazer upload dos seus documentos no bucket 'novos_clientes'
CREATE POLICY "novos_clientes_storage_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'novos_clientes');

-- 4. POLÍTICA DE LEITURA (SELECT) - LGPD COMPLIANCE:
-- * ANÔNIMOS NÃO TÊM ACESSO (ZERO SELECT PARA ANON)!
-- * Administradores/operadores podem ver todos os documentos para avaliação cadastral.
-- * Clientes autenticados só podem ver arquivos da sua própria pasta de documento (CPF/CNPJ).
CREATE POLICY "novos_clientes_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'novos_clientes'
    AND (
        -- Equipe administrativa tem acesso completo aos documentos cadastrais
        (novo_cliente.is_admin(auth.uid()))
        -- OU o arquivo pertence ao documento do próprio cliente logado
        OR EXISTS (
            SELECT 1 FROM novo_cliente.data_new_cliente c
            WHERE c.auth_user_id = auth.uid()
              AND (storage.foldername(name))[1] = regexp_replace(c.cpf_cnpj, '\D', '', 'g')
        )
    )
);

-- 5. POLÍTICA DE ATUALIZAÇÃO (UPDATE):
-- Exclusivo para administradores (clientes comuns não podem sobrescrever arquivos de outros)
CREATE POLICY "novos_clientes_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'novos_clientes'
    AND (novo_cliente.is_admin(auth.uid()))
)
WITH CHECK (
    bucket_id = 'novos_clientes'
    AND (novo_cliente.is_admin(auth.uid()))
);

-- 6. POLÍTICA DE EXCLUSÃO (DELETE):
-- Exclusivo para administradores (impede que um cliente apague documentos do sistema)
CREATE POLICY "novos_clientes_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'novos_clientes'
    AND (novo_cliente.is_admin(auth.uid()))
);
