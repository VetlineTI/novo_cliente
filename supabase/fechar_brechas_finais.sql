-- ==============================================================================
-- BLINDAGEM DE COMBATE AO ESCALONAMENTO DE PRIVILÉGIOS E CRIAÇÃO ANÔNIMA
-- ==============================================================================
-- 1. REVOKE TOTAL DE 'ensure_client_auth_user' PARA 'anon' (Em todos os schemas)
-- 2. BLOQUEIO DEFINITIVO DE AUTO-PROMOÇÃO NA TABELA 'admin_profiles'
-- 3. FECHAMENTO DA VIEW 'data_new_client'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PASSO 1: FECHAR A FUNÇÃO ensure_client_auth_user PARA ANÔNIMOS
-- ------------------------------------------------------------------------------
-- Impede que qualquer desconhecido chame a RPC via REST para criar contas confirmadas
REVOKE EXECUTE ON FUNCTION novo_cliente.ensure_client_auth_user(TEXT, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION novo_cliente.ensure_client_auth_user(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Se ainda existir resquício no schema public, corta também
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'ensure_client_auth_user'
    ) THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.ensure_client_auth_user(TEXT, TEXT, TEXT) FROM anon, public';
        EXECUTE 'DROP FUNCTION IF EXISTS public.ensure_client_auth_user(TEXT, TEXT, TEXT)';
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- PASSO 2: BLINDAR A TABELA admin_profiles CONTRA AUTO-PROMOÇÃO
-- ------------------------------------------------------------------------------
ALTER TABLE novo_cliente.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Remove qualquer política permissiva que tenha ficado ativa no Supabase
DROP POLICY IF EXISTS "Permitir gerenciamento de perfis" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_select_policy" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_modify_policy" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_select_own_or_admin" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_modify_admin_only" ON novo_cliente.admin_profiles;

-- Corta qualquer permissão de tabela para anon
REVOKE ALL ON TABLE novo_cliente.admin_profiles FROM anon, public;
GRANT SELECT ON TABLE novo_cliente.admin_profiles TO authenticated;
GRANT ALL ON TABLE novo_cliente.admin_profiles TO service_role;

-- LEITURA: Usuário comum só vê seu próprio registro. Admins vêem todos.
CREATE POLICY "admin_profiles_select_own_or_admin"
ON novo_cliente.admin_profiles FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR (novo_cliente.is_admin(auth.uid()))
);

-- ESCRITA (INSERT, UPDATE, DELETE): 
-- Ninguém consegue inserir ou alterar registros a menos que JÁ SEJA admin comprovado!
CREATE POLICY "admin_profiles_modify_admin_only"
ON novo_cliente.admin_profiles FOR ALL
TO authenticated
USING (
    (novo_cliente.is_admin(auth.uid()))
)
WITH CHECK (
    (novo_cliente.is_admin(auth.uid()))
);


-- ------------------------------------------------------------------------------
-- PASSO 3: FECHAR A VIEW DE COMPATIBILIDADE data_new_client
-- ------------------------------------------------------------------------------
-- Corta a leitura anônima e força a respeitar o RLS da tabela original
REVOKE ALL ON novo_cliente.data_new_client FROM anon, public;
GRANT SELECT ON novo_cliente.data_new_client TO authenticated, service_role;
ALTER VIEW novo_cliente.data_new_client SET (security_invoker = true);


-- ------------------------------------------------------------------------------
-- PASSO 4: NOTIFICAR O POSTGREST PARA ATUALIZAR O CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

