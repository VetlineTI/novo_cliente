-- ==============================================================================
-- MIGRATION: ADICIONAR CAMPOS DE SIPEAGRO (CNPJ) NA TABELA DATA_NEW_CLIENTE
-- ==============================================================================
-- Adiciona suporte para identificar se o cliente PJ possui registro no SIPEAGRO
-- e armazenar o link do documento / certificado anexado (imagem ou PDF).
-- ==============================================================================

-- 1. ADICIONA AS COLUNAS NA TABELA NOVO_CLIENTE.DATA_NEW_CLIENTE
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS tem_sipeagro BOOLEAN DEFAULT FALSE;

ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS doc_sipeagro_url TEXT;

COMMENT ON COLUMN novo_cliente.data_new_cliente.tem_sipeagro IS 'Indica se a Pessoa Jurídica possui registro no SIPEAGRO (MAPA)';
COMMENT ON COLUMN novo_cliente.data_new_cliente.doc_sipeagro_url IS 'URL do comprovante ou certificado do SIPEAGRO anexado (PDF ou Imagem)';


-- 2. ATUALIZAÇÃO DA RPC INSERT_NOVO_CLIENTE PARA PERSISTIR OS CAMPOS DE SIPEAGRO
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

    -- PASSO 4: Inserção protegida na tabela
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
        doc_sipeagro_url,
        tem_sipeagro,
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
        'ATENA', -- cd_vend SEMPRE FORÇADO A ATENA NO CADASTRO PÚBLICO
        'VTL01', -- tab_pre SEMPRE FORÇADO A VTL01 NO CADASTRO PÚBLICO
        'VTL01', -- tp_ped SEMPRE FORÇADO A VTL01 NO CADASTRO PÚBLICO
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
        COALESCE(client_payload->>'doc_sipeagro_url', NULL),
        COALESCE((client_payload->>'tem_sipeagro')::boolean, (client_payload->>'has_sipeagro')::boolean, false),
        COALESCE(client_payload->>'nire_jucesp', NULL),
        NULL, -- total_protestos FORÇADO A NULL
        NULL, -- bureau_consulted_at FORÇADO A NULL
        0.00, -- limite_credito FORÇADO A ZERO
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

-- Concede permissão de execução
GRANT EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- ROLLBACK (comentado conforme Regras de Segurança Vetline - Seção 8):
-- ==============================================================================
-- ALTER TABLE novo_cliente.data_new_cliente DROP COLUMN IF EXISTS tem_sipeagro;
-- ALTER TABLE novo_cliente.data_new_cliente DROP COLUMN IF EXISTS doc_sipeagro_url;
-- NOTIFY pgrst, 'reload schema';
