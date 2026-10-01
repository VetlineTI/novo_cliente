-- ==============================================================================
-- SCHEMA SUPABASE: SISTEMA DE RATE LIMITING POR IP (SCHEMA novo_cliente)
-- ==============================================================================
-- 1. Criação da tabela de logs de tentativas (novo_cliente.rate_limit_logs)
-- 2. Adição da coluna 'ip_origem' na tabela novo_cliente.data_new_cliente
-- 3. Funções RPC check_rate_limit nos schemas novo_cliente e public
-- 4. Funções RPC log_rate_limit_attempt nos schemas novo_cliente e public
-- 5. Atualização da RPC insert_novo_cliente para bloquear tentativas abusivas
-- ==============================================================================

-- 1. Garante que o schema novo_cliente existe com permissões
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Criação da tabela de logs de requisições por IP no schema novo_cliente
CREATE TABLE IF NOT EXISTS novo_cliente.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'cadastro_cliente',
    document_number VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de alta performance para buscas por janela de tempo
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_created 
ON novo_cliente.rate_limit_logs(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_doc_created 
ON novo_cliente.rate_limit_logs(document_number, created_at DESC);

-- Permissões na tabela de rate limit
GRANT ALL ON TABLE novo_cliente.rate_limit_logs TO anon, authenticated, service_role;

-- 3. Adiciona a coluna 'ip_origem' na tabela de clientes caso não exista
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS ip_origem VARCHAR(50);

-- 4. Função RPC: check_rate_limit (no schema novo_cliente e alias no public)
-- Verifica se o IP excedeu o limite de requisições na janela de tempo (padrão: 3 envios a cada 60 min)
CREATE OR REPLACE FUNCTION novo_cliente.check_rate_limit(
    p_ip TEXT,
    p_max_attempts INT DEFAULT 3,
    p_window_minutes INT DEFAULT 60
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_clean_ip VARCHAR(50);
    v_count INT := 0;
    v_oldest TIMESTAMPTZ;
    v_window_interval INTERVAL;
    v_minutes_left INT := 0;
BEGIN
    v_clean_ip := trim(COALESCE(p_ip, ''));
    
    -- Se IP não informado (ex: ambiente de teste restrito), permite
    IF v_clean_ip = '' OR v_clean_ip = '127.0.0.1' OR v_clean_ip = 'localhost' THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'count', 0,
            'max', p_max_attempts,
            'remaining', p_max_attempts
        );
    END IF;

    v_window_interval := (p_window_minutes || ' minutes')::interval;

    -- Conta quantas requisições foram feitas neste IP na janela de tempo
    SELECT COUNT(*), MIN(created_at)
    INTO v_count, v_oldest
    FROM novo_cliente.rate_limit_logs
    WHERE ip_address = v_clean_ip
      AND created_at >= (timezone('utc'::text, now()) - v_window_interval);

    -- Se atingiu ou ultrapassou o limite máximo
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
            'message', format('Limite de cadastros excedido para este dispositivo/IP (%s envios na última hora). Por segurança, aguarde %s minuto(s) antes de tentar novamente.', p_max_attempts, v_minutes_left)
        );
    END IF;

    -- Permissão concedida
    RETURN jsonb_build_object(
        'allowed', true,
        'count', v_count,
        'max', p_max_attempts,
        'remaining', (p_max_attempts - v_count)
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION novo_cliente.check_rate_limit(TEXT, INT, INT) TO anon, authenticated, service_role;

-- Alias público para compatibilidade com supabase.rpc('check_rate_limit')
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip TEXT,
    p_max_attempts INT DEFAULT 3,
    p_window_minutes INT DEFAULT 60
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
BEGIN
    RETURN novo_cliente.check_rate_limit(p_ip, p_max_attempts, p_window_minutes);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO anon, authenticated, service_role;

-- 5. Função RPC: log_rate_limit_attempt
CREATE OR REPLACE FUNCTION novo_cliente.log_rate_limit_attempt(
    p_ip TEXT,
    p_document TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'cadastro_cliente'
)
RETURNS VOID
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    v_clean_ip VARCHAR(50);
    v_clean_doc VARCHAR(30);
BEGIN
    v_clean_ip := trim(COALESCE(p_ip, ''));
    v_clean_doc := regexp_replace(COALESCE(p_document, ''), '\D', '', 'g');

    IF v_clean_ip <> '' THEN
        INSERT INTO novo_cliente.rate_limit_logs (ip_address, document_number, action)
        VALUES (v_clean_ip, NULLIF(v_clean_doc, ''), COALESCE(p_action, 'cadastro_cliente'));

        -- Limpeza automática de logs com mais de 7 dias (mantém o banco leve)
        DELETE FROM novo_cliente.rate_limit_logs
        WHERE created_at < (timezone('utc'::text, now()) - INTERVAL '7 days');
    END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION novo_cliente.log_rate_limit_attempt(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Alias público
CREATE OR REPLACE FUNCTION public.log_rate_limit_attempt(
    p_ip TEXT,
    p_document TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'cadastro_cliente'
)
RETURNS VOID
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
BEGIN
    PERFORM novo_cliente.log_rate_limit_attempt(p_ip, p_document, p_action);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.log_rate_limit_attempt(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. Atualização da RPC insert_novo_cliente no schema novo_cliente
CREATE OR REPLACE FUNCTION novo_cliente.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
DECLARE
    new_record JSONB;
    v_clean_doc VARCHAR(20);
    v_clean_phone VARCHAR(30);
    v_clean_cep VARCHAR(15);
    v_clean_del_cep VARCHAR(15);
    v_auth_uuid UUID := NULL;
    v_client_ip VARCHAR(50);
    v_rate_check JSONB;
BEGIN
    v_client_ip := trim(COALESCE(client_payload->>'ip_origem', client_payload->>'ip_address', ''));

    -- Verificação de Rate Limit no ato da inserção no banco
    IF v_client_ip <> '' AND v_client_ip <> '127.0.0.1' AND v_client_ip <> 'localhost' THEN
        v_rate_check := novo_cliente.check_rate_limit(v_client_ip, 3, 60);
        IF (v_rate_check->>'allowed')::boolean = false THEN
            RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: %', (v_rate_check->>'message');
        END IF;
    END IF;

    v_clean_doc := regexp_replace(COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number', ''), '\D', '', 'g');
    v_clean_phone := regexp_replace(COALESCE(client_payload->>'telefone', client_payload->>'phone', ''), '\D', '', 'g');
    v_clean_cep := NULLIF(regexp_replace(COALESCE(client_payload->>'cep', client_payload->>'zipcode', ''), '\D', '', 'g'), '');
    v_clean_del_cep := NULLIF(regexp_replace(COALESCE(client_payload->>'entrega_cep', client_payload->>'delivery_zipcode', ''), '\D', '', 'g'), '');

    IF client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' THEN
        v_auth_uuid := (client_payload->>'auth_user_id')::uuid;
    END IF;

    INSERT INTO novo_cliente.data_new_cliente (
        tipo_pessoa,
        cpf_cnpj,
        razao_social_nome,
        nome_fantasia,
        tp_inscricao,
        numero_inscricao,
        crmv,
        possui_ie,
        numero_ie,
        telefone,
        ram_ativ,
        segmento,
        email,
        cep,
        logradouro,
        numero,
        bairro,
        complemento,
        cidade,
        uf,
        endereco_entrega_diferente,
        entrega_cep,
        entrega_logradouro,
        entrega_numero,
        entrega_bairro,
        entrega_complemento,
        entrega_cidade,
        entrega_uf,
        cd_vend,
        tab_pre,
        tp_ped,
        storage_bucket,
        doc_ie_url,
        doc_contrato_social_url,
        doc_comprovante_endereco_url,
        doc_identificacao_url,
        doc_crmv_url,
        doc_receita_url,
        doc_jucesp_url,
        doc_cenprot_url,
        nire_jucesp,
        total_protestos,
        bureau_consulted_at,
        termos_aceitos,
        status,
        auth_user_id,
        observacoes,
        alerta,
        ip_origem
    ) VALUES (
        COALESCE(client_payload->>'tipo_pessoa', client_payload->>'person_type', 'PJ'),
        v_clean_doc,
        COALESCE(client_payload->>'razao_social_nome', client_payload->>'full_name', ''),
        client_payload->>'nome_fantasia',
        COALESCE(client_payload->>'tp_inscricao', 'E'),
        COALESCE(client_payload->>'numero_inscricao', 'ISENTO'),
        client_payload->>'crmv',
        COALESCE((client_payload->>'possui_ie')::boolean, FALSE),
        client_payload->>'numero_ie',
        v_clean_phone,
        client_payload->>'ram_ativ',
        COALESCE(client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        v_clean_cep,
        client_payload->>'logradouro',
        client_payload->>'numero',
        client_payload->>'bairro',
        client_payload->>'complemento',
        client_payload->>'cidade',
        client_payload->>'uf',
        COALESCE((client_payload->>'endereco_entrega_diferente')::boolean, (client_payload->>'has_different_delivery_address')::boolean, FALSE),
        v_clean_del_cep,
        client_payload->>'entrega_logradouro',
        client_payload->>'entrega_numero',
        client_payload->>'entrega_bairro',
        client_payload->>'entrega_complemento',
        client_payload->>'entrega_cidade',
        client_payload->>'entrega_uf',
        COALESCE(client_payload->>'cd_vend', 'ATENA'),
        COALESCE(client_payload->>'tab_pre', 'VTL01'),
        COALESCE(client_payload->>'tp_ped', 'VTL01'),
        COALESCE(client_payload->>'storage_bucket', 'novos_clientes'),
        COALESCE(client_payload->>'doc_ie_url', client_payload->>'doc_sintegra_url'),
        COALESCE(client_payload->>'doc_contrato_social_url', client_payload->>'doc_contract_url'),
        COALESCE(client_payload->>'doc_comprovante_endereco_url', client_payload->>'doc_address_url'),
        COALESCE(client_payload->>'doc_identificacao_url', client_payload->>'doc_photo_id_url'),
        COALESCE(client_payload->>'doc_crmv_url', NULL),
        COALESCE(client_payload->>'doc_receita_url', NULL),
        COALESCE(client_payload->>'doc_jucesp_url', NULL),
        COALESCE(client_payload->>'doc_cenprot_url', NULL),
        COALESCE(client_payload->>'nire_jucesp', NULL),
        CASE WHEN client_payload ? 'total_protestos' AND client_payload->>'total_protestos' IS NOT NULL AND client_payload->>'total_protestos' <> '' 
             THEN (client_payload->>'total_protestos')::integer 
             ELSE NULL END,
        CASE WHEN client_payload ? 'bureau_consulted_at' AND client_payload->>'bureau_consulted_at' IS NOT NULL AND client_payload->>'bureau_consulted_at' <> ''
             THEN (client_payload->>'bureau_consulted_at')::timestamptz
             ELSE NULL END,
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, TRUE),
        COALESCE(client_payload->>'status', 'pendente'),
        v_auth_uuid,
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        COALESCE(client_payload->>'alerta', client_payload->>'alert', NULL),
        NULLIF(v_client_ip, '')
    )
    RETURNING to_jsonb(data_new_cliente.*) INTO new_record;

    -- Registra o log de tentativa com sucesso
    IF v_client_ip <> '' THEN
        PERFORM novo_cliente.log_rate_limit_attempt(v_client_ip, v_clean_doc, 'cadastro_cliente');
    END IF;

    RETURN new_record;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;

-- Alias público para insert_novo_cliente
CREATE OR REPLACE FUNCTION public.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth, extensions
AS $$
BEGIN
    RETURN novo_cliente.insert_novo_cliente(client_payload);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;
