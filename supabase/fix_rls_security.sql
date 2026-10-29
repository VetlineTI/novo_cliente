-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE SEGURANÇA E RLS (ROW LEVEL SECURITY)
-- Tabelas: novo_cliente.data_new_cliente E novo_cliente.admin_profiles
-- ==============================================================================
-- 1. Tabela data_new_cliente:
--    - Remove políticas permissivas que expunham dados a usuários anônimos (anon)
--    - Restringe SELECT e UPDATE aos próprios donos dos dados e à equipe admin
--    - Mantém INSERT público para novos credenciamentos (status 'em_analise')
--    - Cria RPC segura (SECURITY DEFINER) para checagem de duplicidade
-- 2. Tabela admin_profiles (FECHAMENTO DE ESCALONAMENTO DE PRIVILÉGIOS):
--    - REMOVE a política crítica "Permitir gerenciamento de perfis" (ALL para anon/authenticated)
--    - Bloqueia totalmente o papel 'anon' (sem acesso à lista de administradores)
--    - SELECT: Usuário só lê seu próprio registro ou administradores lêem todos
--    - INSERT / UPDATE / DELETE: EXCLUSIVO para quem já é administrador comprovado
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: BLINDAGEM DA TABELA novo_cliente.admin_profiles
-- ==============================================================================

-- 1.1 Habilita RLS
ALTER TABLE novo_cliente.admin_profiles ENABLE ROW LEVEL SECURITY;

-- 1.2 Remove as políticas antigas permissivas que permitiam a qualquer um virar admin
DROP POLICY IF EXISTS "Permitir gerenciamento de perfis" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_select_policy" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_modify_policy" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_select_own_or_admin" ON novo_cliente.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_modify_admin_only" ON novo_cliente.admin_profiles;

-- 1.3 Revoga privilégios do papel anônimo (anon)
REVOKE ALL ON TABLE novo_cliente.admin_profiles FROM anon;
GRANT SELECT ON TABLE novo_cliente.admin_profiles TO authenticated;
GRANT ALL ON TABLE novo_cliente.admin_profiles TO service_role;

-- 1.4 POLÍTICA DE LEITURA (SELECT):
-- Um usuário autenticado só pode ler seu próprio perfil (para saber seu cargo ao logar),
-- ou administradores e operadores podem consultar os perfis da equipe.
CREATE POLICY "admin_profiles_select_own_or_admin"
ON novo_cliente.admin_profiles FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'operador')
    )
);

-- 1.5 POLÍTICA DE ESCRITA (INSERT, UPDATE, DELETE):
-- APENAS quem já é administrador ('admin') pode criar, alterar ou excluir perfis.
-- Usuários comuns e clientes são 100% impedidos de se auto-promover a administrador.
CREATE POLICY "admin_profiles_modify_admin_only"
ON novo_cliente.admin_profiles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
          AND p.is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
          AND p.is_admin = true
    )
);

-- 1.6 Bootstrap de Segurança: Garante que os e-mails mestres tenham perfil de admin inicial
INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin, updated_at)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', 'Administrador Vetline'), 'admin', true, now()
FROM auth.users u
WHERE lower(u.email) IN ('admin@vetline.com.br', 'cadastro@vetline.com.br')
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_admin = true,
    updated_at = now();


-- ==============================================================================
-- PARTE 2: BLINDAGEM DA TABELA novo_cliente.data_new_cliente
-- ==============================================================================

-- 2.1 Habilita RLS
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

-- 2.2 Remove as políticas antigas / vulneráveis
DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura apenas para equipe autenticada" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir atualização de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir exclusão de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção pública de cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir atualização restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir exclusão apenas para administradores" ON novo_cliente.data_new_cliente;

-- 2.3 POLÍTICA 1: INSERT PÚBLICO (Formulário de Credenciamento)
-- Visitantes anônimos e usuários autenticados podem enviar novos cadastros
CREATE POLICY "Permitir inserção pública de cadastro"
ON novo_cliente.data_new_cliente FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2.4 POLÍTICA 2: SELECT RESTRITO (LGPD Compliance)
-- Anônimos NÃO podem mais ler a tabela!
-- Usuário autenticado só lê o SEU PRÓPRIO cadastro, ou equipe administrativa lê todos
CREATE POLICY "Permitir leitura restrita de clientes"
ON novo_cliente.data_new_cliente FOR SELECT
TO authenticated
USING (
    -- O próprio cliente enxerga apenas o seu cadastro
    auth.uid() = auth_user_id
    -- OU usuários com cargo de administração/operador no painel
    OR EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'operador', 'consulta')
    )
);

-- 2.5 POLÍTICA 3: UPDATE RESTRITO
-- Anônimos NUNCA podem atualizar dados!
-- Apenas o próprio cliente no seu painel ou administradores
CREATE POLICY "Permitir atualização restrita de clientes"
ON novo_cliente.data_new_cliente FOR UPDATE
TO authenticated
USING (
    auth.uid() = auth_user_id
    OR EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'operador')
    )
)
WITH CHECK (
    auth.uid() = auth_user_id
    OR EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'operador')
    )
);

-- 2.6 POLÍTICA 4: DELETE EXCLUSIVO PARA ADMINISTRADORES
CREATE POLICY "Permitir exclusão apenas para administradores"
ON novo_cliente.data_new_cliente FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM novo_cliente.admin_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);


-- ==============================================================================
-- PARTE 3: RPC SEGURA PARA CHECAGEM DE DUPLICIDADE (SECURITY DEFINER)
-- Permite ao formulário verificar se CNPJ/CPF já está aprovado sem expor
-- todas as linhas da tabela para usuários não autenticados.
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
