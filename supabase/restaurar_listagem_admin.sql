-- ==============================================================================
-- RESTAURA A LISTAGEM DO PAINEL ADMIN (get_novo_cliente_clients) COM SEGURANÇA
-- ==============================================================================
-- CAUSA: a versão da função que estava no banco não tinha checagem is_admin.
-- O script revogar_funcoes_admin_anon.sql (corretamente) tirou o EXECUTE de
-- authenticated dela, e o painel passou a receber 42501.
-- SOLUÇÃO: recriar a função COM a checagem de admin e devolver o EXECUTE só
-- para authenticated (anon continua sem acesso).
-- Somente schema novo_cliente.
-- ==============================================================================

-- 1. Garante que o ti02 é admin (sem isso a função nega acesso)
INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin)
SELECT id, email, 'Administrador TI', 'admin', true
FROM auth.users
WHERE email = 'ti02@vetlinebrasil.com.br'
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_admin = true;

-- 2. Recria a listagem com checagem de admin
CREATE OR REPLACE FUNCTION novo_cliente.get_novo_cliente_clients(
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
DECLARE
    v_result JSONB;
    v_digits TEXT := regexp_replace(COALESCE(p_search, ''), '\D', '', 'g');
BEGIN
    IF auth.uid() IS NULL OR NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.criado_em DESC), '[]'::jsonb)
    INTO v_result
    FROM novo_cliente.data_new_cliente t
    WHERE (p_status IS NULL OR p_status IN ('', 'todos') OR t.status = p_status)
      AND (
          p_search IS NULL OR p_search = ''
          OR t.razao_social_nome ILIKE '%' || p_search || '%'
          OR COALESCE(t.nome_fantasia, '') ILIKE '%' || p_search || '%'
          OR t.email ILIKE '%' || p_search || '%'
          OR COALESCE(t.cidade, '') ILIKE '%' || p_search || '%'
          OR (v_digits <> '' AND t.cpf_cnpj ILIKE '%' || v_digits || '%')
          OR (v_digits <> '' AND t.telefone ILIKE '%' || v_digits || '%')
      );

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) TO authenticated, service_role;

-- is_admin precisa ser executável por authenticated (é chamada dentro das funções e das políticas)
REVOKE EXECUTE ON FUNCTION novo_cliente.is_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION novo_cliente.is_admin(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- 3. Diagnóstico: funções administrativas e quem pode executar.
--    tem_checagem_admin = false + authenticated_executa = false -> tela correspondente
--    do admin vai dar 42501 (me avise o nome que eu recrio com a checagem).
SELECT p.oid::regprocedure AS funcao,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_executa,
       p.prosrc ILIKE '%is_admin%'                                AS tem_checagem_admin
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'novo_cliente'
  AND p.proname IN ('get_novo_cliente_clients', 'update_novo_cliente', 'delete_novo_cliente',
                    'list_auth_users_with_profiles', 'set_user_role', 'grant_role_by_email', 'is_admin')
ORDER BY 1;

-- 4. Confere o perfil do ti02
SELECT email, role, is_admin FROM novo_cliente.admin_profiles WHERE email = 'ti02@vetlinebrasil.com.br';

