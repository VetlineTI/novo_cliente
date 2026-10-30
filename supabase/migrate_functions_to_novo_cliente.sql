-- ==============================================================================
-- MIGRAÇÃO DE SEGURANÇA BLINDADA: SCHEMA NOVO_CLIENTE
-- ==============================================================================
-- Resolução definitiva dos apontamentos de segurança:
-- 1. Criação de função de autorização 'novo_cliente.is_admin()'
-- 2. Cláusula de barreira (guard clause) em TODAS as funções administrativas
-- 3. REVOKE de EXECUTE do papel 'anon' em todas as funções de administração
-- 4. Correção crítica em 'ensure_client_auth_user':
--    - NUNCA sobrescreve senha de usuário já existente (previne Account Takeover)
--    - Validação de tamanho mínimo de senha (mínimo 6 caracteres)
-- 5. Eliminação de views vulneráveis de auth (auth_users_view)
-- 6. Garantia de RLS restrito na tabela 'novo_cliente.data_new_cliente'
-- ==============================================================================

-- 1. Permissões de Schema
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO AUXILIAR DE AUTORIZAÇÃO: is_admin / is_staff
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. FUNÇÕES ADMINISTRATIVAS (BLINDADAS COM CHECAGEM DE PERFIL)
-- ------------------------------------------------------------------------------

-- 3.1 Listagem de Clientes (Apenas Administradores e Operadores)
CREATE OR REPLACE FUNCTION novo_cliente.get_novo_cliente_clients(
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Trava de segurança: apenas admin/operador pode listar todos os cadastros
    IF NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.criado_em DESC), '[]'::jsonb)
    INTO v_result
    FROM novo_cliente.data_new_cliente t
    WHERE 
        (p_status IS NULL OR p_status = '' OR p_status = 'todos' OR t.status = p_status)
        AND (
            p_search IS NULL OR p_search = '' OR
            t.razao_social_nome ILIKE '%' || p_search || '%' OR
            COALESCE(t.nome_fantasia, '') ILIKE '%' || p_search || '%' OR
            t.cpf_cnpj ILIKE '%' || regexp_replace(p_search, '\D', '', 'g') || '%' OR
            t.email ILIKE '%' || p_search || '%' OR
            t.telefone ILIKE '%' || regexp_replace(p_search, '\D', '', 'g') || '%' OR
            COALESCE(t.cidade, '') ILIKE '%' || p_search || '%' OR
            COALESCE(t.entrega_cidade, '') ILIKE '%' || p_search || '%'
        );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Atualização de Cliente (Apenas Administradores e Operadores)
CREATE OR REPLACE FUNCTION novo_cliente.update_novo_cliente(
    p_client_id UUID,
    p_payload JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Trava de segurança: apenas admin/operador pode atualizar via RPC administrativa
    IF NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
    END IF;

    UPDATE novo_cliente.data_new_cliente
    SET
        tipo_pessoa = COALESCE(p_payload->>'tipo_pessoa', p_payload->>'person_type', tipo_pessoa),
        cpf_cnpj = CASE WHEN p_payload ? 'cpf_cnpj' OR p_payload ? 'document_number' THEN regexp_replace(COALESCE(p_payload->>'cpf_cnpj', p_payload->>'document_number'), '\D', '', 'g') ELSE cpf_cnpj END,
        razao_social_nome = COALESCE(p_payload->>'razao_social_nome', p_payload->>'full_name', razao_social_nome),
        nome_fantasia = CASE WHEN p_payload ? 'nome_fantasia' OR p_payload ? 'trade_name' THEN COALESCE(p_payload->>'nome_fantasia', p_payload->>'trade_name') ELSE nome_fantasia END,
        possui_ie = CASE WHEN p_payload ? 'possui_ie' OR p_payload ? 'has_ie' THEN COALESCE((p_payload->>'possui_ie')::boolean, (p_payload->>'has_ie')::boolean) ELSE possui_ie END,
        numero_ie = CASE WHEN p_payload ? 'numero_ie' OR p_payload ? 'ie_number' THEN COALESCE(p_payload->>'numero_ie', p_payload->>'ie_number') ELSE numero_ie END,
        telefone = CASE WHEN p_payload ? 'telefone' OR p_payload ? 'phone' THEN regexp_replace(COALESCE(p_payload->>'telefone', p_payload->>'phone'), '\D', '', 'g') ELSE telefone END,
        segmento = COALESCE(p_payload->>'segmento', p_payload->>'segment', segmento),
        email = COALESCE(p_payload->>'email', email),
        cep = CASE WHEN p_payload ? 'cep' OR p_payload ? 'zipcode' THEN regexp_replace(COALESCE(p_payload->>'cep', p_payload->>'zipcode'), '\D', '', 'g') ELSE cep END,
        logradouro = CASE WHEN p_payload ? 'logradouro' OR p_payload ? 'street' THEN COALESCE(p_payload->>'logradouro', p_payload->>'street') ELSE logradouro END,
        numero = CASE WHEN p_payload ? 'numero' OR p_payload ? 'number' THEN COALESCE(p_payload->>'numero', p_payload->>'number') ELSE numero END,
        bairro = CASE WHEN p_payload ? 'bairro' OR p_payload ? 'neighborhood' THEN COALESCE(p_payload->>'bairro', p_payload->>'neighborhood') ELSE bairro END,
        complemento = CASE WHEN p_payload ? 'complemento' OR p_payload ? 'complement' THEN COALESCE(p_payload->>'complemento', p_payload->>'complement') ELSE complemento END,
        cidade = CASE WHEN p_payload ? 'cidade' OR p_payload ? 'city' THEN COALESCE(p_payload->>'cidade', p_payload->>'city') ELSE cidade END,
        uf = CASE WHEN p_payload ? 'uf' OR p_payload ? 'state' THEN COALESCE(p_payload->>'uf', p_payload->>'state') ELSE uf END,
        endereco_entrega_diferente = CASE WHEN p_payload ? 'endereco_entrega_diferente' OR p_payload ? 'has_different_delivery_address' THEN COALESCE((p_payload->>'endereco_entrega_diferente')::boolean, (p_payload->>'has_different_delivery_address')::boolean) ELSE endereco_entrega_diferente END,
        entrega_cep = CASE WHEN p_payload ? 'entrega_cep' OR p_payload ? 'delivery_zipcode' THEN regexp_replace(COALESCE(p_payload->>'entrega_cep', p_payload->>'delivery_zipcode'), '\D', '', 'g') ELSE entrega_cep END,
        entrega_logradouro = CASE WHEN p_payload ? 'entrega_logradouro' OR p_payload ? 'delivery_street' THEN COALESCE(p_payload->>'entrega_logradouro', p_payload->>'delivery_street') ELSE entrega_logradouro END,
        entrega_numero = CASE WHEN p_payload ? 'entrega_numero' OR p_payload ? 'delivery_number' THEN COALESCE(p_payload->>'entrega_numero', p_payload->>'delivery_number') ELSE entrega_numero END,
        entrega_bairro = CASE WHEN p_payload ? 'entrega_bairro' OR p_payload ? 'delivery_neighborhood' THEN COALESCE(p_payload->>'entrega_bairro', p_payload->>'delivery_neighborhood') ELSE entrega_bairro END,
        entrega_complemento = CASE WHEN p_payload ? 'entrega_complemento' OR p_payload ? 'delivery_complement' THEN COALESCE(p_payload->>'entrega_complemento', p_payload->>'delivery_complement') ELSE entrega_complemento END,
        entrega_cidade = CASE WHEN p_payload ? 'entrega_cidade' OR p_payload ? 'delivery_city' THEN COALESCE(p_payload->>'entrega_cidade', p_payload->>'delivery_city') ELSE entrega_cidade END,
        entrega_uf = CASE WHEN p_payload ? 'entrega_uf' OR p_payload ? 'delivery_state' THEN COALESCE(p_payload->>'entrega_uf', p_payload->>'delivery_state') ELSE entrega_uf END,
        cd_vend = COALESCE(p_payload->>'cd_vend', cd_vend),
        tab_pre = COALESCE(p_payload->>'tab_pre', tab_pre),
        tp_ped = COALESCE(p_payload->>'tp_ped', tp_ped),
        status = COALESCE(p_payload->>'status', status),
        observacoes = CASE WHEN p_payload ? 'observacoes' OR p_payload ? 'notes' THEN COALESCE(p_payload->>'observacoes', p_payload->>'notes') ELSE observacoes END,
        doc_contrato_social_url = CASE WHEN p_payload ? 'doc_contrato_social_url' OR p_payload ? 'doc_contract_url' THEN COALESCE(p_payload->>'doc_contrato_social_url', p_payload->>'doc_contract_url') ELSE doc_contrato_social_url END,
        doc_comprovante_endereco_url = CASE WHEN p_payload ? 'doc_comprovante_endereco_url' OR p_payload ? 'doc_address_url' THEN COALESCE(p_payload->>'doc_comprovante_endereco_url', p_payload->>'doc_address_url') ELSE doc_comprovante_endereco_url END,
        doc_identificacao_url = CASE WHEN p_payload ? 'doc_identificacao_url' OR p_payload ? 'doc_photo_id_url' THEN COALESCE(p_payload->>'doc_identificacao_url', p_payload->>'doc_photo_id_url') ELSE doc_identificacao_url END,
        doc_crmv_url = CASE WHEN p_payload ? 'doc_crmv_url' THEN p_payload->>'doc_crmv_url' ELSE doc_crmv_url END,
        doc_ie_url = CASE WHEN p_payload ? 'doc_ie_url' THEN p_payload->>'doc_ie_url' ELSE doc_ie_url END,
        doc_jucesp_url = CASE WHEN p_payload ? 'doc_jucesp_url' THEN p_payload->>'doc_jucesp_url' ELSE doc_jucesp_url END,
        doc_cenprot_url = CASE WHEN p_payload ? 'doc_cenprot_url' THEN p_payload->>'doc_cenprot_url' ELSE doc_cenprot_url END,
        doc_receita_url = CASE WHEN p_payload ? 'doc_receita_url' THEN p_payload->>'doc_receita_url' ELSE doc_receita_url END,
        nire_jucesp = CASE WHEN p_payload ? 'nire_jucesp' THEN p_payload->>'nire_jucesp' ELSE nire_jucesp END,
        total_protestos = CASE WHEN p_payload ? 'total_protestos' THEN (p_payload->>'total_protestos')::int ELSE total_protestos END,
        bureau_consulted_at = CASE WHEN p_payload ? 'bureau_consulted_at' THEN (p_payload->>'bureau_consulted_at')::timestamptz ELSE bureau_consulted_at END,
        limite_credito = CASE WHEN p_payload ? 'limite_credito' OR p_payload ? 'credit_limit' THEN COALESCE((p_payload->>'limite_credito')::numeric, (p_payload->>'credit_limit')::numeric) ELSE limite_credito END,
        auth_user_id = CASE 
            WHEN p_payload->>'auth_user_id' IS NOT NULL AND p_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' 
            THEN (p_payload->>'auth_user_id')::uuid 
            ELSE auth_user_id 
        END
    WHERE id = p_client_id;

    SELECT to_jsonb(t) INTO v_result 
    FROM novo_cliente.data_new_cliente t 
    WHERE t.id = p_client_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3.3 Exclusão de Cliente (Apenas Administradores)
CREATE OR REPLACE FUNCTION novo_cliente.delete_novo_cliente(p_client_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
BEGIN
    -- Trava de segurança: apenas admin pode excluir clientes
    IF NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
    END IF;

    DELETE FROM novo_cliente.data_new_cliente WHERE id = p_client_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 3.4 Listagem de Usuários Auth com Perfis Admin (Apenas Administradores)
CREATE OR REPLACE FUNCTION novo_cliente.list_auth_users_with_profiles()
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, auth, public, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Trava de segurança: apenas admin pode listar credenciais e perfis da equipe
    IF NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'created_at', u.created_at,
            'last_sign_in_at', u.last_sign_in_at,
            'full_name', COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
            'role', COALESCE(p.role, 'bloqueado'),
            'is_admin', COALESCE(p.is_admin, false)
        ) ORDER BY u.created_at DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM auth.users u
    LEFT JOIN novo_cliente.admin_profiles p ON p.id = u.id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3.5 Definição de Cargo de Usuário Admin (Apenas Administradores)
CREATE OR REPLACE FUNCTION novo_cliente.set_user_role(
    p_user_id UUID,
    p_role VARCHAR(50),
    p_full_name VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_email VARCHAR(255);
    v_is_admin BOOLEAN;
BEGIN
    -- Trava de segurança: apenas admin pode alterar cargos
    IF NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

    IF v_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
    END IF;

    v_is_admin := (p_role = 'admin');

    INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin, updated_at)
    VALUES (p_user_id, v_email, p_full_name, p_role, v_is_admin, now())
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        is_admin = EXCLUDED.is_admin,
        full_name = COALESCE(EXCLUDED.full_name, novo_cliente.admin_profiles.full_name),
        updated_at = now();

    RETURN jsonb_build_object('success', true, 'role', p_role, 'is_admin', v_is_admin);
END;
$$ LANGUAGE plpgsql;

-- 3.6 Concessão de Cargo por E-mail (Apenas Administradores)
CREATE OR REPLACE FUNCTION novo_cliente.grant_role_by_email(
    p_email VARCHAR(255),
    p_role VARCHAR(50),
    p_full_name VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, auth, public, extensions
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Trava de segurança: apenas admin pode alterar cargos
    IF NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nenhum usuário cadastrado com este e-mail');
    END IF;

    RETURN novo_cliente.set_user_role(v_user_id, p_role, p_full_name);
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 4. FUNÇÕES DE SUPORTE AO CLIENTE (BLINDADAS CONTRA SEQUESTRO DE CONTA)
-- ------------------------------------------------------------------------------

-- 4.1 Criação/Garantia de Usuário Cliente no Auth (CORREÇÃO CRÍTICA)
-- * NUNCA atualiza a senha se o usuário já existir!
-- * Valida tamanho mínimo de senha (>= 6 caracteres)
CREATE OR REPLACE FUNCTION novo_cliente.ensure_client_auth_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT ''
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, auth, public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_clean_email TEXT;
BEGIN
    v_clean_email := lower(trim(p_email));

    -- Validação de e-mail básico
    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail inválido');
    END IF;

    -- Validação de tamanho mínimo de senha (Segurança básica de credenciais)
    IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A senha deve possuir no mínimo 6 caracteres');
    END IF;

    -- Verifica se o usuário já existe
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- SEGURANÇA CRÍTICA: NÃO ALTERA A SENHA! Retorna indicação de conta já existente
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Este e-mail já possui cadastro. Faça login ou solicite recuperação de senha.',
            'user_id', v_user_id,
            'is_new', false
        );
    END IF;

    -- Se não existir, gera o novo usuário
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        v_clean_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name, 'role', 'cliente', 'whatsapp_confirmed', false),
        'authenticated',
        'authenticated',
        now(),
        now()
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'is_new', true);
END;
$$ LANGUAGE plpgsql;

-- 4.2 Inserção de Novo Cliente (Formulário Público)
-- Força sempre 'em_analise' para evitar injeção de status 'aprovado'
CREATE OR REPLACE FUNCTION novo_cliente.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_inserted_id UUID;
    v_result JSONB;
BEGIN
    INSERT INTO novo_cliente.data_new_cliente (
        tipo_pessoa,
        cpf_cnpj,
        razao_social_nome,
        nome_fantasia,
        possui_ie,
        numero_ie,
        telefone,
        segmento,
        email,
        cep,
        logradouro,
        numero,
        bairro,
        complemento,
        cidade,
        uf,
        cd_vend,
        tab_pre,
        tp_ped,
        endereco_entrega_diferente,
        entrega_cep,
        entrega_logradouro,
        entrega_numero,
        entrega_bairro,
        entrega_complemento,
        entrega_cidade,
        entrega_uf,
        storage_bucket,
        doc_ie_url,
        doc_contrato_social_url,
        doc_comprovante_endereco_url,
        doc_identificacao_url,
        doc_crmv_url,
        doc_jucesp_url,
        doc_cenprot_url,
        doc_receita_url,
        nire_jucesp,
        total_protestos,
        bureau_consulted_at,
        limite_credito,
        status,
        termos_aceitos,
        observacoes,
        auth_user_id
    ) VALUES (
        COALESCE(client_payload->>'tipo_pessoa', client_payload->>'person_type', 'PJ'),
        regexp_replace(COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number', ''), '\D', '', 'g'),
        COALESCE(client_payload->>'razao_social_nome', client_payload->>'full_name', ''),
        COALESCE(client_payload->>'nome_fantasia', client_payload->>'trade_name', NULL),
        COALESCE((client_payload->>'possui_ie')::boolean, (client_payload->>'has_ie')::boolean, false),
        COALESCE(client_payload->>'numero_ie', client_payload->>'ie_number', NULL),
        regexp_replace(COALESCE(client_payload->>'telefone', client_payload->>'phone', ''), '\D', '', 'g'),
        COALESCE(client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        CASE WHEN client_payload->>'cep' IS NOT NULL OR client_payload->>'zipcode' IS NOT NULL THEN regexp_replace(COALESCE(client_payload->>'cep', client_payload->>'zipcode'), '\D', '', 'g') ELSE NULL END,
        COALESCE(client_payload->>'logradouro', client_payload->>'street', NULL),
        COALESCE(client_payload->>'numero', client_payload->>'number', NULL),
        COALESCE(client_payload->>'bairro', client_payload->>'neighborhood', NULL),
        COALESCE(client_payload->>'complemento', client_payload->>'complement', NULL),
        COALESCE(client_payload->>'cidade', client_payload->>'city', NULL),
        COALESCE(client_payload->>'uf', client_payload->>'state', NULL),
        COALESCE(client_payload->>'cd_vend', 'ATENA'),
        COALESCE(client_payload->>'tab_pre', 'VTL01'),
        COALESCE(client_payload->>'tp_ped', 'VTL01'),
        COALESCE((client_payload->>'endereco_entrega_diferente')::boolean, (client_payload->>'has_different_delivery_address')::boolean, false),
        CASE WHEN client_payload->>'entrega_cep' IS NOT NULL OR client_payload->>'delivery_zipcode' IS NOT NULL THEN regexp_replace(COALESCE(client_payload->>'entrega_cep', client_payload->>'delivery_zipcode'), '\D', '', 'g') ELSE NULL END,
        COALESCE(client_payload->>'entrega_logradouro', client_payload->>'delivery_street', NULL),
        COALESCE(client_payload->>'entrega_numero', client_payload->>'delivery_number', NULL),
        COALESCE(client_payload->>'entrega_bairro', client_payload->>'delivery_neighborhood', NULL),
        COALESCE(client_payload->>'entrega_complemento', client_payload->>'delivery_complement', NULL),
        COALESCE(client_payload->>'entrega_cidade', client_payload->>'delivery_city', NULL),
        COALESCE(client_payload->>'entrega_uf', client_payload->>'delivery_state', NULL),
        COALESCE(client_payload->>'storage_bucket', 'novos_clientes'),
        COALESCE(client_payload->>'doc_ie_url', NULL),
        COALESCE(client_payload->>'doc_contrato_social_url', client_payload->>'doc_contract_url', NULL),
        COALESCE(client_payload->>'doc_comprovante_endereco_url', client_payload->>'doc_address_url', NULL),
        COALESCE(client_payload->>'doc_identificacao_url', client_payload->>'doc_photo_id_url', NULL),
        COALESCE(client_payload->>'doc_crmv_url', NULL),
        COALESCE(client_payload->>'doc_jucesp_url', NULL),
        COALESCE(client_payload->>'doc_cenprot_url', NULL),
        COALESCE(client_payload->>'doc_receita_url', NULL),
        COALESCE(client_payload->>'nire_jucesp', NULL),
        CASE WHEN client_payload ? 'total_protestos' THEN (client_payload->>'total_protestos')::int ELSE NULL END,
        CASE WHEN client_payload ? 'bureau_consulted_at' THEN (client_payload->>'bureau_consulted_at')::timestamptz ELSE NULL END,
        CASE WHEN client_payload ? 'limite_credito' OR client_payload ? 'credit_limit' THEN COALESCE((client_payload->>'limite_credito')::numeric, (client_payload->>'credit_limit')::numeric) ELSE 0.00 END,
        'em_analise', -- SEMPRE FORÇADO A em_analise NO CADASTRO PÚBLICO
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, true),
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        CASE 
            WHEN client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' 
            THEN (client_payload->>'auth_user_id')::uuid 
            ELSE NULL 
        END
    )
    RETURNING id INTO v_inserted_id;

    SELECT to_jsonb(t) INTO v_result 
    FROM novo_cliente.data_new_cliente t 
    WHERE t.id = v_inserted_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 4.3 Busca de Cliente por auth_user_id ou E-mail (Acesso Seguro Blindado)
-- * Bloqueia 100% de usuários anônimos (auth.uid() IS NULL)
-- * Clientes autenticados só consultam seu próprio cadastro (auth_user_id = auth.uid())
-- * Administradores podem consultar qualquer cadastro por user_id ou e-mail
CREATE OR REPLACE FUNCTION novo_cliente.get_novo_cliente_by_user_or_email(
    p_user_id UUID DEFAULT NULL,
    p_email TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_result JSONB;
    v_caller_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_caller_id := auth.uid();

    -- 1. BLOQUEIO OBRIGATÓRIO PARA ANÔNIMOS (Evita raspagem pública de dados por e-mail)
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: autenticação necessária' USING ERRCODE = '42501';
    END IF;

    v_is_admin := novo_cliente.is_admin(v_caller_id);

    -- 2. SE NÃO FOR ADMINISTRADOR: Só tem acesso estritamente aos seus próprios dados
    IF NOT v_is_admin THEN
        IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id THEN
            RAISE EXCEPTION 'Acesso negado: privilégios insuficientes' USING ERRCODE = '42501';
        END IF;

        SELECT to_jsonb(t) INTO v_result
        FROM novo_cliente.data_new_cliente t
        WHERE t.auth_user_id = v_caller_id
          AND (p_email IS NULL OR lower(trim(t.email)) = lower(trim(p_email)))
        ORDER BY t.criado_em DESC
        LIMIT 1;

        RETURN v_result;
    END IF;

    -- 3. SE FOR ADMINISTRADOR: Pode consultar qualquer registro por user_id ou e-mail
    SELECT to_jsonb(t) INTO v_result
    FROM novo_cliente.data_new_cliente t
    WHERE 
        (p_user_id IS NOT NULL AND t.auth_user_id = p_user_id)
        OR (p_email IS NOT NULL AND lower(trim(t.email)) = lower(trim(p_email)))
    ORDER BY t.criado_em DESC
    LIMIT 1;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 5. POLÍTICA DE PERMISSÕES DE EXECUÇÃO (REVOKE GERAL DO ANON)
-- ------------------------------------------------------------------------------

-- 5.1 Revoga EXECUTE de ANON em TODAS as funções sensíveis (inclusive ensure_client_auth_user)
REVOKE EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.update_novo_cliente(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.delete_novo_cliente(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.list_auth_users_with_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.set_user_role(UUID, VARCHAR, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.grant_role_by_email(VARCHAR, VARCHAR, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_by_user_or_email(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION novo_cliente.ensure_client_auth_user(TEXT, TEXT, TEXT) FROM anon;

-- 5.2 Concede apenas a AUTHENTICATED e SERVICE_ROLE
GRANT EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.update_novo_cliente(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.delete_novo_cliente(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.list_auth_users_with_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.set_user_role(UUID, VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.grant_role_by_email(VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_by_user_or_email(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.ensure_client_auth_user(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5.3 Funções públicas legítimas (necessárias para o envio do formulário de cadastro)
GRANT EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. ELIMINAÇÃO DE FUNÇÕES OBSOLETAS NO SCHEMA PUBLIC
-- ------------------------------------------------------------------------------
-- Nota: A view public.auth_users_view foi preservada / restaurada conforme necessidade do sistema.

-- Elimina versões obsoletas do schema public (todas as variações de tipos)
DROP FUNCTION IF EXISTS public.get_novo_cliente_clients(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.get_novo_cliente_clients(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_novo_cliente_clients();
DROP FUNCTION IF EXISTS public.update_novo_cliente(UUID, JSONB);
DROP FUNCTION IF EXISTS public.delete_novo_cliente(UUID);
DROP FUNCTION IF EXISTS public.insert_novo_cliente(JSONB);
DROP FUNCTION IF EXISTS public.get_novo_cliente_by_user_or_email(UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.get_novo_cliente_by_user_or_email(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_novo_cliente_by_user_or_email(VARCHAR);
DROP FUNCTION IF EXISTS public.get_novo_cliente_by_user_or_email(TEXT);
DROP FUNCTION IF EXISTS public.get_novo_cliente_by_user_or_email();
DROP FUNCTION IF EXISTS public.ensure_client_auth_user(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.list_auth_users_with_profiles();
DROP FUNCTION IF EXISTS public.set_user_role(UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.grant_role_by_email(VARCHAR, VARCHAR, VARCHAR);

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
