-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE TODOS OS ERROS 400 / 403 / 404 DO CONSOLE
-- Conforme as Regras de Segurança Vetline (Seções 1, 3, 6 e 9)
-- ==============================================================================
-- Este script resolve a cascata de erros mantendo 100% de segurança:
-- 1. Cria a RPC 'check_client_already_approved' em public e novo_cliente (elimina 400)
-- 2. Cria a RPC 'insert_novo_cliente' em public e novo_cliente (elimina 400/404)
-- 3. Aplica Rate Limit no servidor e trava campos comerciais (ATENA, VTL01, limite 0.00)
-- 4. Corrige RLS de INSERT na tabela data_new_cliente (elimina 403)
-- 5. Configura Bucket 'novos_clientes' privado com INSERT controlado (elimina 400 do storage)
-- 6. Recarrega o cache do PostgREST
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA NOVO_CLIENTE.DATA_NEW_CLIENTE: RLS E PERMISSÃO DE INSERT SEGURO
-- ------------------------------------------------------------------------------
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção pública de cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir insercao publica de novo cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "novos_clientes_public_insert_policy" ON novo_cliente.data_new_cliente;

-- Inserção pública só é aceita se o status for 'em_analise' e campos comerciais padrão
CREATE POLICY "Permitir insercao publica de novo cadastro"
ON novo_cliente.data_new_cliente FOR INSERT
TO anon, authenticated
WITH CHECK (
    status = 'em_analise'
    AND cd_vend = 'ATENA'
    AND tab_pre = 'VTL01'
    AND tp_ped = 'VTL01'
    AND (limite_credito = 0.00 OR limite_credito IS NULL)
);

GRANT INSERT ON TABLE novo_cliente.data_new_cliente TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. RPC CHECK_CLIENT_ALREADY_APPROVED (EM NOVO_CLIENTE E PUBLIC)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION novo_cliente.check_client_already_approved(p_document TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
DECLARE
    v_clean_doc TEXT;
    v_client novo_cliente.data_new_cliente%ROWTYPE;
BEGIN
    v_clean_doc := regexp_replace(COALESCE(p_document, ''), '\D', '', 'g');
    
    IF v_clean_doc = '' OR (LENGTH(v_clean_doc) <> 11 AND LENGTH(v_clean_doc) <> 14) THEN
        RETURN jsonb_build_object('exists', false);
    END IF;

    SELECT * INTO v_client
    FROM novo_cliente.data_new_cliente
    WHERE status = 'aprovado'
      AND regexp_replace(COALESCE(cpf_cnpj, ''), '\D', '', 'g') = v_clean_doc
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'exists', true,
            'client', jsonb_build_object(
                'razao_social_nome', COALESCE(v_client.razao_social_nome, ''),
                'document_number', COALESCE(v_client.cpf_cnpj, ''),
                'status', v_client.status
            )
        );
    END IF;

    RETURN jsonb_build_object('exists', false);
END;
$$;

-- Wrapper no schema public para compatibilidade com chamadas RPC padrão do Supabase
CREATE OR REPLACE FUNCTION public.check_client_already_approved(p_document TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
BEGIN
    RETURN novo_cliente.check_client_already_approved(p_document);
END;
$$;

REVOKE EXECUTE ON FUNCTION novo_cliente.check_client_already_approved(TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_client_already_approved(TEXT) FROM public;

GRANT EXECUTE ON FUNCTION novo_cliente.check_client_already_approved(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_client_already_approved(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. RATE LIMIT SERVER-SIDE E RPC INSERT_NOVO_CLIENTE
-- ------------------------------------------------------------------------------
-- Captura de IP exclusivamente do cabeçalho do servidor (sem confiar no cliente)
CREATE OR REPLACE FUNCTION novo_cliente.get_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
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

CREATE OR REPLACE FUNCTION novo_cliente.check_rate_limit(
    p_max_attempts INT DEFAULT 5,
    p_window_minutes INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
DECLARE
    v_ip TEXT;
    v_count INT := 0;
    v_oldest TIMESTAMPTZ;
    v_window_interval INTERVAL;
    v_minutes_left INT := 0;
BEGIN
    v_ip := novo_cliente.get_client_ip();
    v_window_interval := (p_window_minutes || ' minutes')::interval;

    SELECT COUNT(*), MIN(created_at)
    INTO v_count, v_oldest
    FROM novo_cliente.rate_limit_logs
    WHERE ip_address = v_ip
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
            'message', format('Muitas tentativas para este IP (%s envios por hora). Tente novamente em %s minuto(s).', p_max_attempts, v_minutes_left)
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'count', v_count,
        'max', p_max_attempts,
        'remaining', (p_max_attempts - v_count),
        'ip', v_ip
    );
END;
$$;

CREATE OR REPLACE FUNCTION novo_cliente.log_rate_limit_attempt(
    p_ip TEXT,
    p_document TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'cadastro'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
BEGIN
    INSERT INTO novo_cliente.rate_limit_logs (ip_address, action, document_number)
    VALUES (p_ip, p_action, regexp_replace(COALESCE(p_document, ''), '\D', '', 'g'));
END;
$$;

-- Função principal de inserção com campos blindados e rate limit forçado
CREATE OR REPLACE FUNCTION novo_cliente.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
DECLARE
    v_inserted_id UUID;
    v_result JSONB;
    v_ip TEXT;
    v_rate_check JSONB;
BEGIN
    -- 1. Captura IP do servidor e executa rate limit dentro da RPC
    v_ip := novo_cliente.get_client_ip();
    v_rate_check := novo_cliente.check_rate_limit(5, 60);
    IF (v_rate_check->>'allowed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Muitas tentativas para este IP. Tente novamente mais tarde.' USING ERRCODE = 'P0001';
    END IF;

    PERFORM novo_cliente.log_rate_limit_attempt(
        v_ip, 
        COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number'), 
        'cadastro'
    );

    -- 2. Inserção com campos comerciais forçados pelo servidor
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
        'ATENA', -- cd_vend FORÇADO PELO SERVIDOR
        'VTL01', -- tab_pre FORÇADO PELO SERVIDOR
        'VTL01', -- tp_ped FORÇADO PELO SERVIDOR
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
        NULL, -- total_protestos FORÇADO A NULL
        NULL, -- bureau_consulted_at FORÇADO A NULL
        0.00, -- limite_credito FORÇADO A 0.00
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
$$;

-- Wrapper public.insert_novo_cliente para PostgREST
CREATE OR REPLACE FUNCTION public.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
BEGIN
    RETURN novo_cliente.insert_novo_cliente(client_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) FROM public;
REVOKE EXECUTE ON FUNCTION public.insert_novo_cliente(JSONB) FROM public;

GRANT EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. BUCKET NOVOS_CLIENTES: PRIVADO, COM UPLOAD CONTROLADO (ZERO SELECT PARA ANON)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'novos_clientes',
    'novos_clientes',
    false, -- BUCKET ESTRITAMENTE PRIVADO
    10485760, -- Máximo 10MB por arquivo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- Políticas de Storage limpas e rigorosas
DROP POLICY IF EXISTS "novos_clientes_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload publico em novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_storage_select_insert" ON storage.objects;

-- Permite INSERT anônimo e autenticado estritamente na pasta do CPF/CNPJ (11 a 14 dígitos)
CREATE POLICY "novos_clientes_storage_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
    bucket_id = 'novos_clientes'
    AND (storage.foldername(name))[1] ~ '^[0-9]{11,14}$'
);

-- Leitura exclusiva para administradores ou para o titular logado do CPF/CNPJ
DROP POLICY IF EXISTS "novos_clientes_storage_select" ON storage.objects;
CREATE POLICY "novos_clientes_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'novos_clientes'
    AND (
        (novo_cliente.is_admin(auth.uid()))
        OR EXISTS (
            SELECT 1 FROM novo_cliente.data_new_cliente c
            WHERE c.auth_user_id = auth.uid()
              AND (storage.foldername(name))[1] = regexp_replace(c.cpf_cnpj, '\D', '', 'g')
        )
    )
);


-- ------------------------------------------------------------------------------
-- 5. NOTIFICA O POSTGREST PARA RECARREGAR O SCHEMA IMEDIATAMENTE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ROLLBACK (comentado):
-- DROP FUNCTION IF EXISTS public.check_client_already_approved(TEXT);
-- DROP FUNCTION IF EXISTS public.insert_novo_cliente(JSONB);
-- DROP POLICY IF EXISTS "Permitir insercao publica de novo cadastro" ON novo_cliente.data_new_cliente;
-- DROP POLICY IF EXISTS "novos_clientes_storage_insert" ON storage.objects;
