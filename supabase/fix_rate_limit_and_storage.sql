-- ==============================================================================
-- CORREÇÃO DE RATE LIMITING E BLINDAGEM DE STORAGE CONTRA ABUSOS
-- ==============================================================================
-- 1. Leitura do IP real diretamente nos cabeçalhos HTTP do servidor (PostgREST)
-- 2. Eliminação da liberação de IP vazio (nenhum IP passa sem verificação)
-- 3. Inserção com Rate Limit automático dentro da RPC insert_novo_cliente
-- 4. Restrição de Upload no Storage (limite de 15MB e bloqueio de uploads arbitrários)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNÇÃO AUXILIAR PARA CAPTURAR O IP REAL DO CLIENTE VIA POSTGREST
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION novo_cliente.get_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_headers JSON;
    v_ip TEXT;
BEGIN
    BEGIN
        v_headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN OTHERS THEN
        v_headers := '{}'::json;
    END;

    v_ip := COALESCE(
        NULLIF(split_part(v_headers->>'x-forwarded-for', ',', 1), ''),
        NULLIF(v_headers->>'cf-connecting-ip', ''),
        NULLIF(v_headers->>'x-real-ip', ''),
        '0.0.0.0'
    );

    RETURN trim(v_ip);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. ATUALIZAÇÃO DO CHECK_RATE_LIMIT COM LEITURA NO SERVIDOR
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION novo_cliente.check_rate_limit(
    p_ip TEXT DEFAULT NULL,
    p_max_attempts INT DEFAULT 5,
    p_window_minutes INT DEFAULT 5
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, auth, extensions
AS $$
DECLARE
    v_clean_ip VARCHAR(50);
    v_count INT := 0;
    v_oldest TIMESTAMPTZ;
    v_window_interval INTERVAL;
    v_minutes_left INT := 0;
BEGIN
    -- Captura o IP diretamente dos headers HTTP do servidor caso não venha informado ou venha vazio
    v_clean_ip := COALESCE(NULLIF(trim(p_ip), ''), novo_cliente.get_client_ip());
    
    -- SEGURANÇA: Se o IP for desconhecido ('0.0.0.0') ou vazio, NÃO LIBERA sem rastreio!
    -- O IP é sempre contabilizado e auditado.
    v_window_interval := (p_window_minutes || ' minutes')::interval;

    SELECT COUNT(*), MIN(created_at)
    INTO v_count, v_oldest
    FROM novo_cliente.rate_limit_logs
    WHERE ip_address = v_clean_ip
      AND created_at >= (timezone('utc'::text, now()) - v_window_interval);

    IF v_count >= p_max_attempts THEN
        IF v_oldest IS NOT NULL THEN
            v_minutes_left := GREATEST(1, ROUND(EXTRACT(EPOCH FROM ((v_oldest + v_window_interval) - timezone('utc'::text, now()))) / 60));
        ELSE
            v_minutes_left := p_window_minutes;
        END IF;

        RETURN jsonb_build_object(
            'allowed', false,
            'count', v_count,
            'max', p_max_attempts,
            'retry_after_minutes', v_minutes_left,
            'message', format('Limite de cadastros excedido para este dispositivo/IP (%s envios a cada %s minutos). Aguarde %s minuto(s) antes de tentar novamente.', p_max_attempts, p_window_minutes, v_minutes_left)
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'count', v_count,
        'max', p_max_attempts,
        'remaining', (p_max_attempts - v_count),
        'client_ip', v_clean_ip
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION novo_cliente.check_rate_limit(TEXT, INT, INT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. EMBUTIR RATE LIMIT AUTOMÁTICO NA insert_novo_cliente
-- ------------------------------------------------------------------------------
-- Se o IP exceder 5 envios em 5 minutos, o próprio banco aborta a inserção
CREATE OR REPLACE FUNCTION novo_cliente.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_inserted_id UUID;
    v_result JSONB;
    v_client_ip TEXT;
    v_rate_check JSONB;
BEGIN
    -- 1. Captura o IP do cliente diretamente no servidor
    v_client_ip := novo_cliente.get_client_ip();

    -- 2. Checagem obrigatória de Rate Limit no servidor (5 envios a cada 5 minutos)
    v_rate_check := novo_cliente.check_rate_limit(v_client_ip, 5, 5);
    IF NOT (v_rate_check->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', (v_rate_check->>'message') USING ERRCODE = '42501';
    END IF;

    -- 3. Registra a tentativa no log de rate limit
    INSERT INTO novo_cliente.rate_limit_logs (ip_address, action, document_number)
    VALUES (
        v_client_ip,
        'cadastro_cliente',
        regexp_replace(COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number', ''), '\D', '', 'g')
    );

    -- 4. Inserção normal e protegida
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
        'em_analise',
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, true),
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        CASE 
            WHEN client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' 
            THEN (client_payload->>'auth_user_id')::uuid 
            ELSE NULL 
        END,
        v_client_ip
    )
    RETURNING id INTO v_inserted_id;

    SELECT to_jsonb(t) INTO v_result 
    FROM novo_cliente.data_new_cliente t 
    WHERE t.id = v_inserted_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 4. CONTROLE DE CUSTO E TAMANHO NO SUPABASE STORAGE (BUCKET novos_clientes)
-- ------------------------------------------------------------------------------
-- Reduz o limite máximo por arquivo de 50MB para 15MB (suficiente para PDFs/fotos e impede estouro de custos)
UPDATE storage.buckets
SET file_size_limit = 15728640 -- 15MB
WHERE id = 'novos_clientes';

-- Atualiza a política de upload no storage para exigir organização em pasta com CPF/CNPJ válido (11 a 14 dígitos)
DROP POLICY IF EXISTS "novos_clientes_storage_insert" ON storage.objects;

CREATE POLICY "novos_clientes_storage_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
    bucket_id = 'novos_clientes'
    -- Impede upload solto na raiz: exige pasta estruturada com CPF/CNPJ (ex: 12345678000199/...)
    AND (storage.foldername(name))[1] ~ '^[0-9]{11,14}$'
);

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

