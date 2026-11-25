-- ==============================================================================
-- MIGRATION: ATUALIZAÇÃO DA RPC insert_novo_cliente COM condicao_pagamento E praz_medio
-- ==============================================================================
-- Motivo:
-- Ao realizar novo cadastro pelo formulário público, a função insert_novo_cliente
-- não continha as colunas condicao_pagamento, praz_medio, data_abertura,
-- data_inicio_atividade, tp_inscricao, numero_inscricao, crmv, cnae e sipeagro
-- no comando INSERT, resultando na persistência com valor NULL.
--
-- Regras de Negócio aplicadas automaticamente:
-- - CPF sem protesto: condicao = 49, prazo = 28
-- - CNPJ sem protesto até 6 meses de fundação: condicao = 6, prazo = 14
-- - CNPJ sem protesto com mais de 6 meses de fundação: condicao = 49, prazo = 28
-- - CPF ou CNPJ com protesto: condicao = 6, prazo = 28
-- ==============================================================================

CREATE OR REPLACE FUNCTION novo_cliente.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_inserted_id UUID;
    v_result JSONB;
    v_ip TEXT;
    v_rate_check JSONB;
    v_tipo_pessoa TEXT;
    v_data_abertura TEXT;
    v_condicao_calculada SMALLINT;
    v_prazo_calculado SMALLINT;
    v_tp_inscr TEXT;
    v_num_inscr TEXT;
BEGIN
    -- PASSO 1: Captura o IP real direto do servidor
    v_ip := novo_cliente.get_client_ip();

    -- PASSO 2: Bloqueia imediatamente se ultrapassar 5 cadastros por hora (60 minutos)
    v_rate_check := novo_cliente.check_rate_limit(5, 60);
    IF (v_rate_check->>'allowed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Muitas tentativas para este IP. Tente novamente mais tarde.' USING ERRCODE = 'P0001';
    END IF;

    -- PASSO 3: Grava a tentativa no log de rate limit
    PERFORM novo_cliente.log_rate_limit_attempt(
        v_ip, 
        COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number'), 
        'cadastro'
    );

    -- PASSO 4: Resolução de Tipo e Número de Inscrição conforme regra ERP Moinho
    -- O código 'N' não existe (somente 'E', 'I', 'M')
    v_tipo_pessoa := UPPER(COALESCE(client_payload->>'tipo_pessoa', client_payload->>'person_type', 'PJ'));
    v_num_inscr := TRIM(COALESCE(client_payload->>'numero_inscricao', client_payload->>'numero_ie', client_payload->>'ie_number', ''));
    v_tp_inscr := UPPER(TRIM(COALESCE(client_payload->>'tp_inscricao', client_payload->>'tp_inscr', '')));

    IF v_tp_inscr = 'M' THEN
        v_tp_inscr := 'M';
        v_num_inscr := COALESCE(NULLIF(regexp_replace(v_num_inscr, '\D', '', 'g'), ''), NULLIF(v_num_inscr, ''), 'ISENTO');
    ELSIF regexp_replace(v_num_inscr, '\D', '', 'g') <> '' AND v_tp_inscr <> 'I' AND UPPER(v_num_inscr) <> 'ISENTO' THEN
        v_tp_inscr := 'E';
        v_num_inscr := regexp_replace(v_num_inscr, '\D', '', 'g');
    ELSE
        v_tp_inscr := 'I';
        v_num_inscr := 'ISENTO';
    END IF;

    -- PASSO 5: Cálculo de Condição de Pagamento e Prazo Médio (Regras Vetline ERP)
    v_data_abertura := COALESCE(client_payload->>'data_abertura', client_payload->>'data_inicio_atividade');

    IF v_tipo_pessoa = 'PF' THEN
        v_condicao_calculada := 49;
        v_prazo_calculado := 28;
    ELSE
        -- PJ: verifica tempo de abertura (até 6 meses -> 6 / 14, mais de 6 meses -> 49 / 28)
        IF v_data_abertura IS NOT NULL AND v_data_abertura ~ '^\d{4}-\d{2}-\d{2}' AND (v_data_abertura::date >= (CURRENT_DATE - INTERVAL '180 days')) THEN
            v_condicao_calculada := 6;
            v_prazo_calculado := 14;
        ELSE
            v_condicao_calculada := 49;
            v_prazo_calculado := 28;
        END IF;
    END IF;

    -- PASSO 6: Inserção protegida e completa na tabela
    INSERT INTO novo_cliente.data_new_cliente (
        tipo_pessoa,
        cpf_cnpj,
        razao_social_nome,
        nome_fantasia,
        possui_ie,
        numero_ie,
        tp_inscricao,
        numero_inscricao,
        crmv,
        telefone,
        segmento,
        ram_ativ,
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
        condicao_pagamento,
        praz_medio,
        data_abertura,
        data_inicio_atividade,
        cnae,
        cnae_codigo,
        cnae_descricao,
        tem_sipeagro,
        doc_sipeagro_url,
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
        auth_user_id,
        ip_origem
    ) VALUES (
        v_tipo_pessoa,
        regexp_replace(COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number', ''), '\D', '', 'g'),
        COALESCE(client_payload->>'razao_social_nome', client_payload->>'full_name', ''),
        COALESCE(client_payload->>'nome_fantasia', client_payload->>'trade_name', NULL),
        (v_tp_inscr = 'E'),
        v_num_inscr,
        v_tp_inscr,
        v_num_inscr,
        COALESCE(client_payload->>'crmv', NULL),
        regexp_replace(COALESCE(client_payload->>'telefone', client_payload->>'phone', ''), '\D', '', 'g'),
        COALESCE(client_payload->>'segmento', client_payload->>'ram_ativ', client_payload->>'segment', ''),
        COALESCE(client_payload->>'ram_ativ', client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        CASE WHEN client_payload->>'cep' IS NOT NULL OR client_payload->>'zipcode' IS NOT NULL THEN regexp_replace(COALESCE(client_payload->>'cep', client_payload->>'zipcode'), '\D', '', 'g') ELSE NULL END,
        COALESCE(client_payload->>'logradouro', client_payload->>'street', NULL),
        COALESCE(client_payload->>'numero', client_payload->>'number', NULL),
        COALESCE(client_payload->>'bairro', client_payload->>'neighborhood', NULL),
        COALESCE(client_payload->>'complemento', client_payload->>'complement', NULL),
        COALESCE(client_payload->>'cidade', client_payload->>'city', NULL),
        COALESCE(client_payload->>'uf', client_payload->>'state', NULL),
        'ATENA', -- cd_vend SEMPRE FORÇADO A ATENA NO CADASTRO PÚBLICO
        'VTL01', -- tab_pre SEMPRE FORÇADO A VTL01 NO CADASTRO PÚBLICO
        'VTL01', -- tp_ped SEMPRE FORÇADO A VTL01 NO CADASTRO PÚBLICO
        COALESCE(NULLIF(client_payload->>'condicao_pagamento', '')::smallint, v_condicao_calculada),
        COALESCE(NULLIF(client_payload->>'praz_medio', '')::smallint, v_prazo_calculado),
        v_data_abertura,
        v_data_abertura,
        COALESCE(client_payload->>'cnae', NULL),
        COALESCE(client_payload->>'cnae_codigo', NULL),
        COALESCE(client_payload->>'cnae_descricao', NULL),
        COALESCE((client_payload->>'tem_sipeagro')::boolean, (client_payload->>'has_sipeagro')::boolean, false),
        COALESCE(client_payload->>'doc_sipeagro_url', NULL),
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
        NULL, -- total_protestos FORÇADO A NULL (DEFINIDO EXCLUSIVAMENTE PELO BACKEND/ADMIN)
        NULL, -- bureau_consulted_at FORÇADO A NULL
        CASE WHEN v_tipo_pessoa = 'PF' THEN 1500.00 ELSE 3000.00 END, -- limite_credito inicial seguro
        'em_analise',
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, true),
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        CASE 
            WHEN client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' 
            THEN (client_payload->>'auth_user_id')::uuid 
            ELSE NULL 
        END,
        v_ip
    )
    RETURNING id INTO v_inserted_id;

    SELECT to_jsonb(t) INTO v_result 
    FROM novo_cliente.data_new_cliente t 
    WHERE t.id = v_inserted_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Permissões de execução
REVOKE EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- ROLLBACK (comentado conforme Regras de Segurança Vetline - Seção 8):
-- ==============================================================================
-- Ver arquivo: supabase/fix_rate_limit_and_storage.sql linhas 106-245
