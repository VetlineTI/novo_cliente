-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE SEGURANÇA E RLS (ROW LEVEL SECURITY)
-- Tabelas: novo_cliente.data_new_cliente E novo_cliente.admin_profiles
-- ==============================================================================
-- 1. Garante a função helper SECURITY DEFINER (Sem recursão de RLS)
-- 2. Aplica RLS estrito em novo_cliente.admin_profiles (Sem auto-promoção de admin)
-- 3. Aplica RLS estrito em novo_cliente.data_new_cliente (LGPD e dados protegidos)
-- 4. Cria RPC segura para duplicidade de cadastro (check_client_already_approved)
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: FUNÇÃO AUXILIAR DE AUTORIZAÇÃO (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION novo_cliente.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = novo_cliente, auth, public
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
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION novo_cliente.is_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION novo_cliente.is_admin(UUID) TO authenticated, service_role;


-- ==============================================================================
-- PARTE 2: BLINDAGEM DA TABELA novo_cliente.admin_profiles
-- ==============================================================================

-- 2.1 Habilita RLS
ALTER TABLE novo_cliente.admin_profiles ENABLE ROW LEVEL SECURITY;

-- 2.2 Remove as políticas antigas permissivas ou recursivas
DROP POLICY IF EXISTS "Permitir gerenciamento de perfis" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_select_policy" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_modify_policy" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_select_own_or_admin" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_modify_admin_only" ON novo_cliente.admin_profiles;

-- 2.3 Revoga privilégios do papel anônimo (anon)
REVOKE ALL ON TABLE novo_cliente.admin_profiles FROM anon;
GRANT SELECT ON TABLE novo_cliente.admin_profiles TO authenticated;
GRANT ALL ON TABLE novo_cliente.admin_profiles TO service_role;

-- 2.4 POLÍTICA DE LEITURA (SELECT):
-- O próprio usuário lê seu perfil OU administradores lêem todos
CREATE POLICY "admin_profiles_select_own_or_admin"
ON novo_cliente.admin_profiles FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR (novo_cliente.is_admin(auth.uid()))
);

-- 2.5 POLÍTICA DE ESCRITA (INSERT, UPDATE, DELETE):
-- APENAS quem já é administrador pode modificar a tabela admin_profiles
CREATE POLICY "admin_profiles_modify_admin_only"
ON novo_cliente.admin_profiles FOR ALL
TO authenticated
USING (
    (novo_cliente.is_admin(auth.uid()))
)
WITH CHECK (
    (novo_cliente.is_admin(auth.uid()))
);

-- 2.6 Bootstrap de Segurança: Garante que os e-mails mestres tenham perfil de admin
INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin, updated_at)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', 'Administrador Vetline'), 'admin', true, now()
FROM auth.users u
WHERE lower(u.email) IN ('admin@vetline.com.br', 'cadastro@vetline.com.br')
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_admin = true,
    updated_at = now();


-- ==============================================================================
-- PARTE 3: BLINDAGEM DA TABELA novo_cliente.data_new_cliente (LGPD)
-- ==============================================================================

-- 3.1 Habilita RLS
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

-- 3.2 Remove as políticas antigas / vulneráveis
DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura apenas para equipe autenticada" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir atualização de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir exclusão de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção pública de cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir atualização restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir exclusão apenas para administradores" ON novo_cliente.data_new_cliente;

-- 3.3 POLÍTICA 1: INSERT PÚBLICO (Formulário de Credenciamento)
CREATE POLICY "Permitir inserção pública de cadastro"
ON novo_cliente.data_new_cliente FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3.4 POLÍTICA 2: SELECT RESTRITO (LGPD Compliance)
-- Usuário autenticado só lê o SEU PRÓPRIO cadastro, ou equipe administrativa lê todos
CREATE POLICY "Permitir leitura restrita de clientes"
ON novo_cliente.data_new_cliente FOR SELECT
TO authenticated
USING (
    auth.uid() = auth_user_id
    OR (novo_cliente.is_admin(auth.uid()))
);

-- 3.5 POLÍTICA 3: UPDATE RESTRITO
-- O cliente edita seu próprio cadastro ou administradores editam
CREATE POLICY "Permitir atualização restrita de clientes"
ON novo_cliente.data_new_cliente FOR UPDATE
TO authenticated
USING (
    auth.uid() = auth_user_id
    OR (novo_cliente.is_admin(auth.uid()))
)
WITH CHECK (
    auth.uid() = auth_user_id
    OR (novo_cliente.is_admin(auth.uid()))
);

-- 3.6 POLÍTICA 4: DELETE EXCLUSIVO PARA ADMINISTRADORES
CREATE POLICY "Permitir exclusão apenas para administradores"
ON novo_cliente.data_new_cliente FOR DELETE
TO authenticated
USING (
    (novo_cliente.is_admin(auth.uid()))
);


-- ==============================================================================
-- PARTE 4: RPC SEGURA PARA CHECAGEM DE DUPLICIDADE (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION novo_cliente.check_client_already_approved(p_document TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
DECLARE
    v_clean_doc TEXT;
    v_client novo_cliente.data_new_cliente%ROWTYPE;
BEGIN
    v_clean_doc := REGEXP_REPLACE(COALESCE(p_document, ''), '\D', '', 'g');
    
    IF v_clean_doc = '' OR (LENGTH(v_clean_doc) <> 11 AND LENGTH(v_clean_doc) <> 14) THEN
        RETURN jsonb_build_object('exists', false);
    END IF;

    SELECT * INTO v_client
    FROM novo_cliente.data_new_cliente
    WHERE status = 'aprovado'
      AND (
        REGEXP_REPLACE(COALESCE(cpf_cnpj, ''), '\D', '', 'g') = v_clean_doc
        OR REGEXP_REPLACE(COALESCE(document_number, ''), '\D', '', 'g') = v_clean_doc
      )
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'exists', true,
            'client', jsonb_build_object(
                'razao_social_nome', COALESCE(v_client.razao_social_nome, v_client.full_name, ''),
                'document_number', COALESCE(v_client.document_number, v_client.cpf_cnpj, ''),
                'status', v_client.status
            )
        );
    END IF;

    RETURN jsonb_build_object('exists', false);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION novo_cliente.check_client_already_approved(TEXT) TO anon, authenticated, service_role;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
