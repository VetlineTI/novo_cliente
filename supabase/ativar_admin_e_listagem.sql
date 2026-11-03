-- ==============================================================================
-- ATIVAÇÃO DE ACESSO ADMINISTRATIVO E LISTAGEM DE CADASTROS
-- Conforme as Regras de Segurança Vetline (Seções 1, 2, 3 e 9)
-- ==============================================================================
-- Este script:
-- 1. Vincula o usuário 'ti02@vetlinebrasil.com.br' como ADMIN em novo_cliente.admin_profiles
-- 2. Cria wrappers públicos para get_novo_cliente_clients e update_novo_cliente
-- 3. Garante que a função is_admin reconheça o usuário autenticado
-- 4. Recarrega o cache do PostgREST
-- ==============================================================================

-- 1. GARANTE O PERFIL DE ADMIN PARA O E-MAIL DO PAINEL
INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin, created_at, updated_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Administrador TI'), 
    'admin', 
    true, 
    now(), 
    now()
FROM auth.users
WHERE email = 'ti02@vetlinebrasil.com.br'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_admin = true,
    updated_at = now();


-- 2. GARANTE A FUNÇÃO IS_ADMIN COMPATÍVEL E SEGURA
CREATE OR REPLACE FUNCTION novo_cliente.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, auth, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM novo_cliente.admin_profiles
        WHERE id = p_user_id 
          AND role IN ('admin', 'operador')
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION novo_cliente.is_admin(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION novo_cliente.is_admin(UUID) TO authenticated, service_role;


-- 3. WRAPPER PUBLIC.GET_NOVO_CLIENTE_CLIENTS
CREATE OR REPLACE FUNCTION public.get_novo_cliente_clients(
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
BEGIN
    RETURN novo_cliente.get_novo_cliente_clients(p_status, p_search);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_novo_cliente_clients(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_novo_cliente_clients(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) TO authenticated, service_role;


-- 4. WRAPPER PUBLIC.UPDATE_NOVO_CLIENTE
CREATE OR REPLACE FUNCTION public.update_novo_cliente(
    p_client_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
BEGIN
    RETURN novo_cliente.update_novo_cliente(p_client_id, p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_novo_cliente(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_novo_cliente(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.update_novo_cliente(UUID, JSONB) TO authenticated, service_role;


-- 5. RECARREGA O CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';

