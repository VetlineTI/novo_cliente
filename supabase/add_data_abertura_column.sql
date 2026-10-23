-- ==============================================================================
-- MIGRAÇÃO: Adicionar colunas de Data de Abertura / Início de Atividade
-- Schema: novo_cliente
-- Corrige o erro: Could not find the 'data_abertura' column of 'data_new_cliente' in the schema cache
-- Executar no SQL Editor do Supabase Dashboard
-- ==============================================================================

-- 1. Garante que o schema existe
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Adiciona as colunas na tabela principal novo_cliente.data_new_cliente
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS data_abertura VARCHAR(50),
ADD COLUMN IF NOT EXISTS data_inicio_atividade VARCHAR(50);

-- 3. Adiciona comentários explicativos
COMMENT ON COLUMN novo_cliente.data_new_cliente.data_abertura IS 'Data de abertura oficial do CNPJ na Receita Federal (ex: 2021-05-10 ou 10/05/2021)';
COMMENT ON COLUMN novo_cliente.data_new_cliente.data_inicio_atividade IS 'Data de início de atividade oficial da empresa (compatibilidade)';

-- 4. Atualiza a view / tabela de compatibilidade data_new_client
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client'
    ) THEN
        DROP VIEW IF EXISTS novo_cliente.data_new_client CASCADE;
        CREATE VIEW novo_cliente.data_new_client AS
        SELECT * FROM novo_cliente.data_new_cliente;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE novo_cliente.data_new_client 
        ADD COLUMN IF NOT EXISTS data_abertura VARCHAR(50),
        ADD COLUMN IF NOT EXISTS data_inicio_atividade VARCHAR(50);
    END IF;
END $$;

-- 5. Atualização da Função RPC insert_novo_cliente para incluir data_abertura
CREATE OR REPLACE FUNCTION public.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
DECLARE
    new_record JSONB;
    v_clean_doc VARCHAR(20);
    v_clean_phone VARCHAR(30);
    v_clean_cep VARCHAR(15);
    v_clean_del_cep VARCHAR(15);
    v_auth_uuid UUID := NULL;
    v_data_abertura VARCHAR(50);
BEGIN
    v_clean_doc := regexp_replace(COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number', ''), '\D', '', 'g');
    v_clean_phone := regexp_replace(COALESCE(client_payload->>'telefone', client_payload->>'phone', ''), '\D', '', 'g');
    v_clean_cep := NULLIF(regexp_replace(COALESCE(client_payload->>'cep', client_payload->>'zipcode', ''), '\D', '', 'g'), '');
    v_clean_del_cep := NULLIF(regexp_replace(COALESCE(client_payload->>'entrega_cep', client_payload->>'delivery_zipcode', ''), '\D', '', 'g'), '');
    v_data_abertura := COALESCE(client_payload->>'data_abertura', client_payload->>'dataAbertura', client_payload->>'data_inicio_atividade', NULL);

    IF client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' THEN
        v_auth_uuid := (client_payload->>'auth_user_id')::uuid;
    END IF;

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
        data_abertura,
        data_inicio_atividade,
        status,
        termos_aceitos,
        observacoes,
        auth_user_id
    ) VALUES (
        COALESCE(client_payload->>'tipo_pessoa', client_payload->>'person_type', 'PJ'),
        v_clean_doc,
        COALESCE(client_payload->>'razao_social_nome', client_payload->>'full_name', ''),
        COALESCE(client_payload->>'nome_fantasia', client_payload->>'trade_name', NULL),
        COALESCE((client_payload->>'possui_ie')::boolean, (client_payload->>'has_ie')::boolean, false),
        COALESCE(client_payload->>'numero_ie', client_payload->>'ie_number', NULL),
        v_clean_phone,
        COALESCE(client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        v_clean_cep,
        COALESCE(client_payload->>'logradouro', client_payload->>'street', NULL),
        COALESCE(client_payload->>'numero', client_payload->>'number', NULL),
        COALESCE(client_payload->>'bairro', client_payload->>'neighborhood', NULL),
        COALESCE(client_payload->>'complemento', client_payload->>'complement', NULL),
        COALESCE(client_payload->>'cidade', client_payload->>'city', NULL),
        COALESCE(client_payload->>'uf', client_payload->>'state', NULL),
        COALESCE((client_payload->>'endereco_entrega_diferente')::boolean, (client_payload->>'has_different_delivery_address')::boolean, false),
        v_clean_del_cep,
        COALESCE(client_payload->>'entrega_logradouro', client_payload->>'delivery_street', NULL),
        COALESCE(client_payload->>'entrega_numero', client_payload->>'delivery_number', NULL),
        COALESCE(client_payload->>'entrega_bairro', client_payload->>'delivery_neighborhood', NULL),
        COALESCE(client_payload->>'entrega_complemento', client_payload->>'delivery_complement', NULL),
        COALESCE(client_payload->>'entrega_cidade', client_payload->>'delivery_city', NULL),
        COALESCE(client_payload->>'entrega_uf', client_payload->>'delivery_state', NULL),
        COALESCE(client_payload->>'cd_vend', 'ATENA'),
        COALESCE(client_payload->>'tab_pre', 'VTL01'),
        COALESCE(client_payload->>'tp_ped', 'VTL01'),
        COALESCE(client_payload->>'storage_bucket', 'novos_clientes'),
        client_payload->>'doc_ie_url',
        COALESCE(client_payload->>'doc_contrato_social_url', client_payload->>'doc_contract_url', NULL),
        COALESCE(client_payload->>'doc_comprovante_endereco_url', client_payload->>'doc_address_url', NULL),
        COALESCE(client_payload->>'doc_identificacao_url', client_payload->>'doc_photo_id_url', NULL),
        client_payload->>'doc_crmv_url',
        client_payload->>'doc_receita_url',
        client_payload->>'doc_jucesp_url',
        client_payload->>'doc_cenprot_url',
        client_payload->>'nire_jucesp',
        (client_payload->>'total_protestos')::integer,
        (client_payload->>'bureau_consulted_at')::timestamptz,
        v_data_abertura,
        v_data_abertura,
        COALESCE(client_payload->>'status', 'pendente'),
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, true),
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        v_auth_uuid
    )
    RETURNING to_jsonb(novo_cliente.data_new_cliente.*) INTO new_record;

    RETURN new_record;
END;
$$ LANGUAGE plpgsql;

-- 6. Atualização da Função RPC update_novo_cliente para incluir data_abertura
CREATE OR REPLACE FUNCTION public.update_novo_cliente(
    p_client_id UUID,
    p_payload JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
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
        doc_receita_url = CASE WHEN p_payload ? 'doc_receita_url' THEN p_payload->>'doc_receita_url' ELSE doc_receita_url END,
        doc_jucesp_url = CASE WHEN p_payload ? 'doc_jucesp_url' THEN p_payload->>'doc_jucesp_url' ELSE doc_jucesp_url END,
        doc_cenprot_url = CASE WHEN p_payload ? 'doc_cenprot_url' THEN p_payload->>'doc_cenprot_url' ELSE doc_cenprot_url END,
        nire_jucesp = CASE WHEN p_payload ? 'nire_jucesp' THEN p_payload->>'nire_jucesp' ELSE nire_jucesp END,
        total_protestos = CASE WHEN p_payload ? 'total_protestos' THEN (p_payload->>'total_protestos')::integer ELSE total_protestos END,
        bureau_consulted_at = CASE WHEN p_payload ? 'bureau_consulted_at' THEN (p_payload->>'bureau_consulted_at')::timestamptz ELSE bureau_consulted_at END,
        data_abertura = CASE WHEN p_payload ? 'data_abertura' OR p_payload ? 'dataAbertura' OR p_payload ? 'data_inicio_atividade' THEN COALESCE(p_payload->>'data_abertura', p_payload->>'dataAbertura', p_payload->>'data_inicio_atividade') ELSE data_abertura END,
        data_inicio_atividade = CASE WHEN p_payload ? 'data_abertura' OR p_payload ? 'dataAbertura' OR p_payload ? 'data_inicio_atividade' THEN COALESCE(p_payload->>'data_inicio_atividade', p_payload->>'data_abertura', p_payload->>'dataAbertura') ELSE data_inicio_atividade END,
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

-- 7. Garante permissões de acesso
GRANT ALL ON TABLE novo_cliente.data_new_cliente TO authenticated, anon, service_role;
GRANT SELECT ON novo_cliente.data_new_client TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_novo_cliente(UUID, JSONB) TO anon, authenticated, service_role;

-- 8. Força o recarregamento do schema cache do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
