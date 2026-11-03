-- ==============================================================================
-- FECHAR FUNÇÕES ADMINISTRATIVAS EXECUTÁVEIS POR anon (SEM LOGIN)
-- Conforme as Regras de Segurança Vetline (Seções 3 e 9)
-- ==============================================================================
-- CAUSA: "REVOKE ... FROM anon" não basta. Toda função nasce com EXECUTE para
-- PUBLIC (e o Supabase ainda concede para anon por default privileges), então o
-- anon continuava executando. Além disso, um script anterior (destravar_admin.sql)
-- concedeu EXECUTE de get_novo_cliente_clients para anon - já corrigido.
--
-- O QUE ESTE SCRIPT FAZ (em todas as sobrecargas, SOMENTE no schema novo_cliente;
-- o schema public não é tocado):
-- 1. REVOKE EXECUTE de PUBLIC e anon.
-- 2. Se o corpo da função tem checagem is_admin -> GRANT só para authenticated.
--    Se NÃO tem checagem -> também REVOKE de authenticated (fica só service_role)
--    e avisa no resultado, porque qualquer conta logada de qualquer sistema
--    (talao, rh, ...) conseguiria usá-la.
-- 3. Muda o default para que funções novas não nasçam abertas para PUBLIC/anon.
-- 4. Mostra um relatório final de quem pode executar cada função.
--
-- IMPACTO: o painel admin continua funcionando (admin logado = authenticated +
-- checagem is_admin dentro da função). Formulário público não usa nenhuma delas.
--
-- ROLLBACK (comentado) - NÃO recomendado, reabre a falha:
-- GRANT EXECUTE ON FUNCTION novo_cliente.<funcao>(<args>) TO anon;
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    r RECORD;
    v_guarded BOOLEAN;
BEGIN
    FOR r IN
        SELECT p.oid,
               p.oid::regprocedure AS sig,
               p.prosrc
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'novo_cliente'
          AND p.proname IN (
              'grant_role_by_email',
              'set_user_role',
              'list_auth_users_with_profiles',
              'get_novo_cliente_clients',
              'update_novo_cliente',
              'delete_novo_cliente',
              'ensure_client_auth_user'
          )
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);

        -- Considera protegida se a função checa is_admin
        v_guarded := r.prosrc ILIKE '%is_admin%'
                  OR r.prosrc ~* 'novo_cliente\.(get_novo_cliente_clients|update_novo_cliente|delete_novo_cliente|list_auth_users_with_profiles|set_user_role|grant_role_by_email)\s*\(';

        IF v_guarded THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
        ELSE
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
            RAISE NOTICE 'SEM checagem de admin, liberada só para service_role: %', r.sig;
        END IF;
    END LOOP;
END $$;

-- Funções novas criadas pelo postgres nesses schemas não nascem mais abertas
ALTER DEFAULT PRIVILEGES IN SCHEMA novo_cliente REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- LEITURA DA TABELA: remove a política USING (true) criada por scripts anteriores
-- (liberar_admin_imediato.sql / destravar_admin.sql), que deixava QUALQUER conta
-- logada de qualquer sistema ler todos os cadastros. Volta para: dono ou admin.
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE novo_cliente.data_new_cliente FROM anon;

DROP POLICY IF EXISTS "Permitir leitura de clientes para equipe autenticada" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura restrita de clientes" ON novo_cliente.data_new_cliente;

CREATE POLICY "Permitir leitura restrita de clientes"
ON novo_cliente.data_new_cliente FOR SELECT
TO authenticated
USING (
    auth_user_id = auth.uid()
    OR (novo_cliente.is_admin(auth.uid()))
);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- RELATÓRIO: anon_executa deve ser FALSE em todas as linhas.
-- Linhas com tem_checagem_admin = false ficaram só com service_role.
-- ------------------------------------------------------------------------------
SELECT n.nspname AS schema,
       p.oid::regprocedure AS funcao,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_executa,
       (p.prosrc ILIKE '%is_admin%'
        OR p.prosrc ~* 'novo_cliente\.(get_novo_cliente_clients|update_novo_cliente|delete_novo_cliente|list_auth_users_with_profiles|set_user_role|grant_role_by_email)\s*\(') AS tem_checagem_admin
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'novo_cliente'
  AND p.proname IN (
      'grant_role_by_email', 'set_user_role', 'list_auth_users_with_profiles',
      'get_novo_cliente_clients', 'update_novo_cliente', 'delete_novo_cliente',
      'ensure_client_auth_user'
  )
ORDER BY 1, 2;

-- Políticas atuais da tabela (nenhuma deve ter qual = 'true' para SELECT/UPDATE/DELETE)
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'novo_cliente' AND tablename = 'data_new_cliente'
ORDER BY cmd, policyname;
