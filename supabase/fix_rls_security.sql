-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE SEGURANÇA E LGPD: RLS (ROW LEVEL SECURITY)
-- Tabela: novo_cliente.data_new_cliente
-- ==============================================================================
-- 1. Remove políticas permissivas que expunham dados a usuários anônimos (anon)
-- 2. Restringe SELECT e UPDATE aos próprios donos dos dados e à equipe admin
-- 3. Mantém INSERT público para novos credenciamentos
-- 4. Cria RPC segura (SECURITY DEFINER) para conferência de duplicidade
-- ==============================================================================

-- 1. Garante que RLS está habilitado
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

-- 2. Remove as políticas antigas / vulneráveis
DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura apenas para equipe autenticada" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir atualização de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir exclusão de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção pública de cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir atualização restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir exclusão apenas para administradores" ON novo_cliente.data_new_cliente;

-- ------------------------------------------------------------------------------
-- POLÍTICA 1: INSERT PÚBLICO (Formulário de Credenciamento)
-- Visitantes anônimos e usuários autenticados podem enviar novos cadastros
-- ------------------------------------------------------------------------------
CREATE POLICY "Permitir inserção pública de cadastro"
ON novo_cliente.data_new_cliente FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- POLÍTICA 2: SELECT RESTRITO (LGPD Compliance)
-- Anônimos NÃO podem mais ler a tabela!
-- Usuário autenticado só lê a SUA PRÓPRIA linha, ou administradores lêem todas
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- POLÍTICA 3: UPDATE RESTRITO
-- Anônimos NUNCA podem atualizar dados!
-- Apenas o próprio cliente no seu painel ou administradores
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- POLÍTICA 4: DELETE EXCLUSIVO PARA ADMINISTRADORES
-- ------------------------------------------------------------------------------
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
-- 3. FUNÇÃO RPC SEGURA PARA CHECAGEM DE DUPLICIDADE (SECURITY DEFINER)
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

-- Concede permissão para a RPC ser executada pelo formulário público
GRANT EXECUTE ON FUNCTION novo_cliente.check_client_already_approved(TEXT) TO anon, authenticated, service_role;

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';

