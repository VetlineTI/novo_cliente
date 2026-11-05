-- ==============================================================================
-- CORREÇÃO DA RPC novo_cliente.update_novo_cliente
-- ==============================================================================
-- PROBLEMA: a versão anterior gravava em possui_ie / numero_ie, colunas que NÃO
-- existem em novo_cliente.data_new_cliente -> a RPC falhava e o status "aprovado"
-- não era salvo por ela. Também ignorava cd_clien, alerta, tp_inscricao,
-- numero_inscricao, crmv e ram_ativ.
--
-- * Mantém a checagem de admin (auth.uid() NULL = negado).
-- * search_path fixo, EXECUTE só para authenticated (dentro checa is_admin).
-- * Somente schema novo_cliente.
--
-- ROLLBACK (comentado): reexecutar a definição anterior em
-- supabase/migrate_functions_to_novo_cliente.sql (seção 3.2).
-- ==============================================================================

CREATE OR REPLACE FUNCTION novo_cliente.update_novo_cliente(
    p_client_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR NOT novo_cliente.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
    END IF;

    IF p_client_id IS NULL THEN
        RAISE EXCEPTION 'p_client_id obrigatório' USING ERRCODE = '22023';
    END IF;

    UPDATE novo_cliente.data_new_cliente
    SET
        tipo_pessoa = COALESCE(p_payload->>'tipo_pessoa', p_payload->>'person_type', tipo_pessoa),
        cpf_cnpj = CASE WHEN p_payload ? 'cpf_cnpj' OR p_payload ? 'document_number' THEN regexp_replace(COALESCE(p_payload->>'cpf_cnpj', p_payload->>'document_number'), '\D', '', 'g') ELSE cpf_cnpj END,
        razao_social_nome = COALESCE(p_payload->>'razao_social_nome', p_payload->>'full_name', razao_social_nome),
        nome_fantasia = CASE WHEN p_payload ? 'nome_fantasia' OR p_payload ? 'trade_name' THEN COALESCE(p_payload->>'nome_fantasia', p_payload->>'trade_name') ELSE nome_fantasia END,
        tp_inscricao = CASE WHEN p_payload ? 'tp_inscricao' THEN COALESCE(NULLIF(p_payload->>'tp_inscricao', ''), tp_inscricao) ELSE tp_inscricao END,
        numero_inscricao = CASE WHEN p_payload ? 'numero_inscricao' THEN COALESCE(NULLIF(p_payload->>'numero_inscricao', ''), 'ISENTO') ELSE numero_inscricao END,
        crmv = CASE WHEN p_payload ? 'crmv' THEN p_payload->>'crmv' ELSE crmv END,
        telefone = CASE WHEN p_payload ? 'telefone' OR p_payload ? 'phone' THEN regexp_replace(COALESCE(p_payload->>'telefone', p_payload->>'phone'), '\D', '', 'g') ELSE telefone END,
        ram_ativ = CASE WHEN p_payload ? 'ram_ativ' THEN p_payload->>'ram_ativ' ELSE ram_ativ END,
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
        cd_vend = COALESCE(NULLIF(p_payload->>'cd_vend', ''), cd_vend),
        tab_pre = COALESCE(NULLIF(p_payload->>'tab_pre', ''), tab_pre),
        tp_ped = COALESCE(NULLIF(p_payload->>'tp_ped', ''), tp_ped),
        cd_clien = CASE WHEN p_payload ? 'cd_clien' AND NULLIF(p_payload->>'cd_clien', '') IS NOT NULL THEN p_payload->>'cd_clien' ELSE cd_clien END,
        alerta = CASE WHEN p_payload ? 'alerta' THEN p_payload->>'alerta' ELSE alerta END,
        status = COALESCE(NULLIF(p_payload->>'status', ''), status),
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
        total_protestos = CASE WHEN p_payload ? 'total_protestos' THEN NULLIF(p_payload->>'total_protestos', '')::int ELSE total_protestos END,
        bureau_consulted_at = CASE WHEN p_payload ? 'bureau_consulted_at' THEN NULLIF(p_payload->>'bureau_consulted_at', '')::timestamptz ELSE bureau_consulted_at END,
        limite_credito = CASE WHEN p_payload ? 'limite_credito' OR p_payload ? 'credit_limit' THEN COALESCE(NULLIF(p_payload->>'limite_credito', '')::numeric, NULLIF(p_payload->>'credit_limit', '')::numeric, limite_credito) ELSE limite_credito END,
        auth_user_id = CASE
            WHEN p_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' THEN (p_payload->>'auth_user_id')::uuid
            ELSE auth_user_id
        END
    WHERE id = p_client_id;

    SELECT to_jsonb(t) INTO v_result
    FROM novo_cliente.data_new_cliente t
    WHERE t.id = p_client_id;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION novo_cliente.update_novo_cliente(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION novo_cliente.update_novo_cliente(UUID, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

