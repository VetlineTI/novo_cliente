-- ==============================================================================
-- RESTAURAÇÃO DA VIEW: public.auth_users_view
-- ==============================================================================
-- Esta view expõe os dados de auth.users necessários para sistemas ou integrações
-- que dependiam da listagem no schema public.
-- ==============================================================================

-- 1. Criação ou substituição da view public.auth_users_view
CREATE OR REPLACE VIEW public.auth_users_view AS
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' AS full_name,
    created_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users;

-- 2. Permissões de acesso
-- Concede permissão para service_role e authenticated (e anon se sua aplicação externa precisar)
GRANT SELECT ON public.auth_users_view TO service_role, authenticated, anon;

-- 3. Recarrega o schema cache do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';

