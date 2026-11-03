-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE CADASTRO E RPC (SCHEMA NOVO_CLIENTE)
-- Conforme as Regras de Segurança Vetline (Seções 1, 3, 6 e 9)
-- ==============================================================================
-- 1. Garante todas as colunas necessárias na tabela novo_cliente.data_new_cliente
-- 2. Cria a tabela novo_cliente.rate_limit_logs para a auditoria de tentativas
-- 3. Configura política de RLS de INSERT segura (status em_analise/pendente, limites oficiais)
-- 4. Cria funções blindadas e resilientes: check_client_already_approved e insert_novo_cliente
-- 5. Configura Bucket 'novos_clientes' privado com upload controlado
-- 6. Recarrega o cache do PostgREST
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GARANTE O SCHEMA E TODAS AS COLUNAS NA TABELA DATA_NEW_CLIENTE
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;

ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS crmv VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS tp_inscricao VARCHAR(5) DEFAULT 'E';
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS numero_inscricao VARCHAR(50) DEFAULT 'ISENTO';
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS ram_ativ VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS ip_origem VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS doc_receita_url TEXT;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS doc_jucesp_url TEXT;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS doc_cenprot_url TEXT;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS doc_sintegra_url TEXT;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS nire_jucesp VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS total_protestos INT;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS bureau_consulted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS data_abertura VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS data_inicio_atividade VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS cnae VARCHAR(255);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS cnae_codigo VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS cnae_descricao VARCHAR(255);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS telecom_carrier VARCHAR(100);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS telecom_line_type VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS telecom_is_voip BOOLEAN DEFAULT FALSE;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS telecom_sim_swap BOOLEAN DEFAULT FALSE;
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS telecom_sim_status VARCHAR(50);
ALTER TABLE novo_cliente.data_new_cliente ADD COLUMN IF NOT EXISTS telecom_checked_at TIMESTAMP WITH TIME ZONE;


-- ------------------------------------------------------------------------------
-- 2. TABELA DE AUDITORIA DE RATE LIMITING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS novo_cliente.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'cadastro_cliente',
    document_number VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_created 
ON novo_cliente.rate_limit_logs(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_doc_created 
ON novo_cliente.rate_limit_logs(document_number, created_at DESC);

GRANT ALL ON TABLE novo_cliente.rate_limit_logs TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. POLÍTICA DE RLS DE INSERT EM DATA_NEW_CLIENTE
-- ------------------------------------------------------------------------------
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção pública de cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir insercao publica de novo cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "novos_clientes_public_insert_policy" ON novo_cliente.data_new_cliente;

-- Inserção pública aceita cadastros com status em_analise/pendente, tabelas padrão e limites oficiais
CREATE POLICY "Permitir insercao publica de novo cadastro"
ON novo_cliente.data_new_cliente FOR INSERT
TO anon, authenticated
WITH CHECK (
    status IN ('em_analise', 'pendente')
    AND tab_pre = 'VTL01'
    AND tp_ped = 'VTL01'
    AND (
        limite_credito IS NULL 
        OR limite_credito = 0.00 
        OR limite_credito = 1500.00 
        OR limite_credito = 3000.00
    )
);

GRANT INSERT ON TABLE novo_cliente.data_new_cliente TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. CAPTURA DE IP E RATE LIMIT RESILIENTE
-- ------------------------------------------------------------------------------
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
    p_max_attempts INT DEFAULT 30,
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

    -- Se não identificou IP específico (0.0.0.0), não bloqueia coletivamente
    IF v_ip = '0.0.0.0' THEN
        RETURN jsonb_build_object('allowed', true, 'count', 0, 'max', p_max_attempts, 'remaining', p_max_attempts, 'ip', v_ip);
    END IF;

    v_window_interval := (p_window_minutes || ' minutes')::interval;

    BEGIN
        SELECT COUNT(*), MIN(created_at)
        INTO v_count, v_oldest
        FROM novo_cliente.rate_limit_logs
        WHERE ip_address = v_ip
          AND created_at >= (timezone('utc'::text, now()) - v_window_interval);
    EXCEPTION WHEN OTHERS THEN
        v_count := 0;
    END;

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
    BEGIN
        INSERT INTO novo_cliente.rate_limit_logs (ip_address, action, document_number)
        VALUES (p_ip, p_action, regexp_replace(COALESCE(p_document, ''), '\D', '', 'g'));
    EXCEPTION WHEN OTHERS THEN
        -- Silencioso para não travar o cadastro legítimo
    END;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. RPC CHECK_CLIENT_ALREADY_APPROVED (EM NOVO_CLIENTE E PUBLIC)
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
-- 6. RPC INSERT_NOVO_CLIENTE COM SUPORTE ROBUSTO A CAMPOS COMERCIAIS
-- ------------------------------------------------------------------------------
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
    v_cd_vend TEXT;
    v_limite NUMERIC(15, 2);
    v_auth_uuid UUID := NULL;
BEGIN
    -- 1. Captura IP do servidor e executa rate limit dentro da RPC
    v_ip := novo_cliente.get_client_ip();
    v_rate_check := novo_cliente.check_rate_limit(30, 60);
    IF (v_rate_check->>'allowed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Muitas tentativas para este IP. Tente novamente mais tarde.' USING ERRCODE = 'P0001';
    END IF;

    PERFORM novo_cliente.log_rate_limit_attempt(
        v_ip, 
        COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number'), 
        'cadastro'
    );

    -- Determina o vendedor: só aceita cd_vend existente e ativo em talao.vendedor, senão 'ATENA'
    v_cd_vend := NULL;
    IF NULLIF(trim(client_payload->>'cd_vend'), '') IS NOT NULL THEN
        SELECT trim(v.cd_vend::text) INTO v_cd_vend
        FROM talao.vendedor v
        WHERE lower(trim(v.cd_vend::text)) = lower(trim(client_payload->>'cd_vend'))
          AND COALESCE(v.nome_equipe::text, '') NOT ILIKE '%INATIV%'
        LIMIT 1;
    END IF;
    v_cd_vend := COALESCE(v_cd_vend, 'ATENA');

    -- Determina o limite de crédito oficial (PF: 1.500,00 | PJ: 3.000,00)
    IF (client_payload->>'limite_credito') IS NOT NULL AND (client_payload->>'limite_credito') <> '' THEN
        v_limite := (client_payload->>'limite_credito')::numeric;
    ELSIF (client_payload->>'credit_limit') IS NOT NULL AND (client_payload->>'credit_limit') <> '' THEN
        v_limite := (client_payload->>'credit_limit')::numeric;
    ELSIF UPPER(COALESCE(client_payload->>'tipo_pessoa', client_payload->>'person_type', 'PJ')) = 'PF' THEN
        v_limite := 1500.00;
    ELSE
        v_limite := 3000.00;
    END IF;

    -- Valida com segurança se auth_user_id existe realmente em auth.users para nunca violar FK
    IF client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' THEN
        BEGIN
            SELECT id INTO v_auth_uuid 
            FROM auth.users 
            WHERE id = (client_payload->>'auth_user_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_auth_uuid := NULL;
        END;
    END IF;

    -- 2. Inserção protegida na tabela
    INSERT INTO novo_cliente.data_new_cliente (
        tipo_pessoa,
        cpf_cnpj,
        razao_social_nome,
        nome_fantasia,
        tp_inscricao,
        numero_inscricao,
        crmv,
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
        COALESCE(client_payload->>'tp_inscricao', 'I'),
        COALESCE(client_payload->>'numero_inscricao', 'ISENTO'),
        COALESCE(client_payload->>'crmv', NULL),
        regexp_replace(COALESCE(client_payload->>'telefone', client_payload->>'phone', ''), '\D', '', 'g'),
        COALESCE(client_payload->>'ram_ativ', client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        CASE WHEN client_payload->>'cep' IS NOT NULL OR client_payload->>'zipcode' IS NOT NULL THEN regexp_replace(COALESCE(client_payload->>'cep', client_payload->>'zipcode'), '\D', '', 'g') ELSE NULL END,
        COALESCE(client_payload->>'logradouro', client_payload->>'street', NULL),
        COALESCE(client_payload->>'numero', client_payload->>'number', NULL),
        COALESCE(client_payload->>'bairro', client_payload->>'neighborhood', NULL),
        COALESCE(client_payload->>'complemento', client_payload->>'complement', NULL),
        COALESCE(client_payload->>'cidade', client_payload->>'city', NULL),
        COALESCE(client_payload->>'uf', client_payload->>'state', NULL),
        v_cd_vend,
        'VTL01',
        'VTL01',
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
        NULL,
        NULL,
        v_limite,
        'em_analise',
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, true),
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        v_auth_uuid,
        v_ip
    )
    RETURNING id INTO v_inserted_id;

    SELECT to_jsonb(t) INTO v_result 
    FROM novo_cliente.data_new_cliente t 
    WHERE t.id = v_inserted_id;

    RETURN v_result;
END;
$$;

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
-- 7. BUCKET NOVOS_CLIENTES PRIVADO
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'novos_clientes',
    'novos_clientes',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

DROP POLICY IF EXISTS "novos_clientes_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload publico em novos_clientes" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_storage_select_insert" ON storage.objects;

CREATE POLICY "novos_clientes_storage_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
    bucket_id = 'novos_clientes'
    AND (storage.foldername(name))[1] ~ '^[0-9]{11,14}$'
);

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
-- 8. RECARREGAR O SCHEMA POSTGREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
