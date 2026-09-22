-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR COLUNAS DE AUDITORIA & BUREAU NA TABELA NOVO_CLIENTE.DATA_NEW_CLIENTE
-- Executar no SQL Editor do Supabase Dashboard
-- ==============================================================================

-- 1. Adiciona as colunas na tabela física real: data_new_cliente
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS doc_receita_url TEXT,
ADD COLUMN IF NOT EXISTS doc_jucesp_url TEXT,
ADD COLUMN IF NOT EXISTS doc_cenprot_url TEXT,
ADD COLUMN IF NOT EXISTS nire_jucesp TEXT,
ADD COLUMN IF NOT EXISTS total_protestos INTEGER,
ADD COLUMN IF NOT EXISTS bureau_consulted_at TIMESTAMPTZ;

-- 2. Recria a VIEW de compatibilidade para incluir as novas colunas
CREATE OR REPLACE VIEW novo_cliente.data_new_client AS
SELECT * FROM novo_cliente.data_new_cliente;

-- 3. Atualiza a função RPC update_novo_cliente para aceitar as novas colunas
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

-- 4. Concessão de permissões
GRANT ALL ON TABLE novo_cliente.data_new_cliente TO authenticated, anon, service_role;
GRANT SELECT ON novo_cliente.data_new_client TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_novo_cliente(UUID, JSONB) TO anon, authenticated, service_role;
