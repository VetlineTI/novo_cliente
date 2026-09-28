-- ==============================================================================
-- SCRIPT DE AJUSTE SQL: TIPO DE INSCRIÇÃO, NÚMERO DE INSCRIÇÃO E CRMV
-- Schemas: novo_cliente (data_new_cliente)
-- ==============================================================================

-- 1. Garante que o schema novo_cliente existe
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Adiciona as novas colunas exclusivamente na tabela física: novo_cliente.data_new_cliente
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS tp_inscricao VARCHAR(5) DEFAULT 'E',
ADD COLUMN IF NOT EXISTS numero_inscricao VARCHAR(50) DEFAULT 'ISENTO',
ADD COLUMN IF NOT EXISTS crmv VARCHAR(50);

-- 3. Recria a VIEW de compatibilidade novo_cliente.data_new_client com as novas colunas
DROP VIEW IF EXISTS novo_cliente.data_new_client CASCADE;
CREATE OR REPLACE VIEW novo_cliente.data_new_client AS
SELECT * FROM novo_cliente.data_new_cliente;
GRANT ALL ON novo_cliente.data_new_client TO anon, authenticated, service_role;

-- 4. Adiciona constraint de validação para tp_inscricao se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_tp_inscricao'
    ) THEN
        ALTER TABLE novo_cliente.data_new_cliente 
        ADD CONSTRAINT check_tp_inscricao 
        CHECK (tp_inscricao IN ('E', 'I', 'M'));
    END IF;
END $$;

-- 5. Normalização e migração dos registros legados existentes
-- 5.1 Para Pessoa Física (PF): Sempre Isento ('I'), com texto fixo 'ISENTO'
UPDATE novo_cliente.data_new_cliente
SET 
    tp_inscricao = 'I',
    numero_inscricao = 'ISENTO',
    possui_ie = FALSE
WHERE tipo_pessoa = 'PF' OR (tp_inscricao IS NULL AND tipo_pessoa = 'PF');

-- 5.2 Para Pessoa Jurídica (PJ) que possui Inscrição Estadual informada
UPDATE novo_cliente.data_new_cliente
SET 
    tp_inscricao = 'E',
    numero_inscricao = COALESCE(NULLIF(numero_ie, ''), 'ISENTO')
WHERE (tipo_pessoa = 'PJ' OR tipo_pessoa IS NULL)
  AND (tp_inscricao IS NULL OR tp_inscricao = 'E')
  AND numero_ie IS NOT NULL 
  AND UPPER(numero_ie) NOT IN ('ISENTO', 'ISENTA', '-', '');

-- 5.3 Para Pessoa Jurídica (PJ) Isenta ou sem Inscrição Estadual
UPDATE novo_cliente.data_new_cliente
SET 
    tp_inscricao = 'I',
    numero_inscricao = 'ISENTO',
    possui_ie = FALSE
WHERE (tipo_pessoa = 'PJ' OR tipo_pessoa IS NULL)
  AND (numero_ie IS NULL OR UPPER(numero_ie) IN ('ISENTO', 'ISENTA', '-', ''));

-- 6. Atualização da RPC insert_novo_cliente para incluir tp_inscricao, numero_inscricao e crmv
CREATE OR REPLACE FUNCTION public.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
DECLARE
    v_inserted novo_cliente.data_new_cliente%ROWTYPE;
    v_person_type VARCHAR(2);
    v_tp_inscricao VARCHAR(5);
    v_numero_inscricao VARCHAR(50);
    v_crmv VARCHAR(50);
    v_possui_ie BOOLEAN;
BEGIN
    -- Identifica tipo de pessoa
    v_person_type := COALESCE(client_payload->>'tipo_pessoa', client_payload->>'person_type', 'PJ');
    
    -- Se for Pessoa Física (PF), força Isento ('I') e 'ISENTO'
    IF v_person_type = 'PF' THEN
        v_tp_inscricao := 'I';
        v_numero_inscricao := 'ISENTO';
        v_possui_ie := FALSE;
        v_crmv := NULLIF(TRIM(COALESCE(client_payload->>'crmv', client_payload->>'numero_crmv', '')), '');
    ELSE
        v_tp_inscricao := COALESCE(client_payload->>'tp_inscricao', client_payload->>'tipo_inscricao', 'E');
        IF v_tp_inscricao = 'I' THEN
            v_numero_inscricao := 'ISENTO';
            v_possui_ie := FALSE;
        ELSE
            v_numero_inscricao := COALESCE(client_payload->>'numero_inscricao', client_payload->>'numero_ie', client_payload->>'ie_number', 'ISENTO');
            v_possui_ie := (v_tp_inscricao = 'E');
        END IF;
        v_crmv := NULL;
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
        status,
        termos_aceitos,
        auth_user_id
    ) VALUES (
        v_person_type,
        COALESCE(client_payload->>'cpf_cnpj', client_payload->>'document_number', ''),
        COALESCE(client_payload->>'razao_social_nome', client_payload->>'full_name', ''),
        client_payload->>'nome_fantasia',
        v_tp_inscricao,
        v_numero_inscricao,
        v_crmv,
        v_possui_ie,
        v_numero_inscricao,
        COALESCE(client_payload->>'telefone', client_payload->>'phone', ''),
        client_payload->>'ram_ativ',
        COALESCE(client_payload->>'segmento', client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        client_payload->>'cep',
        client_payload->>'logradouro',
        client_payload->>'numero',
        client_payload->>'bairro',
        client_payload->>'complemento',
        client_payload->>'cidade',
        client_payload->>'uf',
        COALESCE((client_payload->>'endereco_entrega_diferente')::BOOLEAN, (client_payload->>'has_different_delivery_address')::BOOLEAN, false),
        client_payload->>'entrega_cep',
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
        client_payload->>'doc_ie_url',
        COALESCE(client_payload->>'doc_contrato_social_url', client_payload->>'doc_contract_url'),
        COALESCE(client_payload->>'doc_comprovante_endereco_url', client_payload->>'doc_address_url'),
        COALESCE(client_payload->>'doc_identificacao_url', client_payload->>'doc_photo_id_url'),
        client_payload->>'doc_crmv_url',
        COALESCE(client_payload->>'status', 'pendente'),
        COALESCE((client_payload->>'termos_aceitos')::BOOLEAN, (client_payload->>'terms_accepted')::BOOLEAN, true),
        CASE 
            WHEN client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~* '^[0-9a-fA-F-]{36}$'
            THEN (client_payload->>'auth_user_id')::UUID 
            ELSE NULL 
        END
    )
    RETURNING * INTO v_inserted;

    RETURN to_jsonb(v_inserted);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;

-- 7. Atualização da RPC update_novo_cliente_profile para suportar tp_inscricao, numero_inscricao e crmv
CREATE OR REPLACE FUNCTION public.update_novo_cliente_profile(
    p_client_id UUID,
    p_payload JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
DECLARE
    v_updated novo_cliente.data_new_cliente%ROWTYPE;
BEGIN
    UPDATE novo_cliente.data_new_cliente
    SET
        razao_social_nome = COALESCE(p_payload->>'razao_social_nome', p_payload->>'full_name', razao_social_nome),
        nome_fantasia = CASE WHEN p_payload ? 'nome_fantasia' OR p_payload ? 'trade_name' THEN COALESCE(p_payload->>'nome_fantasia', p_payload->>'trade_name') ELSE nome_fantasia END,
        tp_inscricao = CASE WHEN p_payload ? 'tp_inscricao' THEN p_payload->>'tp_inscricao' ELSE tp_inscricao END,
        numero_inscricao = CASE WHEN p_payload ? 'numero_inscricao' THEN p_payload->>'numero_inscricao' ELSE numero_inscricao END,
        numero_ie = CASE WHEN p_payload ? 'numero_inscricao' THEN p_payload->>'numero_inscricao' ELSE numero_ie END,
        possui_ie = CASE WHEN p_payload ? 'tp_inscricao' THEN (p_payload->>'tp_inscricao' = 'E') ELSE possui_ie END,
        crmv = CASE WHEN p_payload ? 'crmv' OR p_payload ? 'numero_crmv' THEN COALESCE(p_payload->>'crmv', p_payload->>'numero_crmv') ELSE crmv END,
        telefone = COALESCE(p_payload->>'telefone', p_payload->>'phone', telefone),
        email = COALESCE(p_payload->>'email', email),
        ram_ativ = CASE WHEN p_payload ? 'ram_ativ' THEN p_payload->>'ram_ativ' ELSE ram_ativ END,
        segmento = CASE WHEN p_payload ? 'segmento' OR p_payload ? 'segment' THEN COALESCE(p_payload->>'segmento', p_payload->>'segment') ELSE segmento END,
        cep = COALESCE(p_payload->>'cep', p_payload->>'zipcode', cep),
        logradouro = COALESCE(p_payload->>'logradouro', p_payload->>'street', logradouro),
        numero = COALESCE(p_payload->>'numero', p_payload->>'number', numero),
        bairro = COALESCE(p_payload->>'bairro', p_payload->>'neighborhood', bairro),
        complemento = CASE WHEN p_payload ? 'complemento' OR p_payload ? 'complement' THEN COALESCE(p_payload->>'complemento', p_payload->>'complement') ELSE complemento END,
        cidade = COALESCE(p_payload->>'cidade', p_payload->>'city', cidade),
        uf = COALESCE(p_payload->>'uf', p_payload->>'state', uf),
        endereco_entrega_diferente = CASE 
            WHEN p_payload ? 'endereco_entrega_diferente' THEN (p_payload->>'endereco_entrega_diferente')::BOOLEAN 
            WHEN p_payload ? 'has_different_delivery_address' THEN (p_payload->>'has_different_delivery_address')::BOOLEAN 
            ELSE endereco_entrega_diferente 
        END,
        entrega_cep = CASE WHEN p_payload ? 'entrega_cep' OR p_payload ? 'delivery_zipcode' THEN COALESCE(p_payload->>'entrega_cep', p_payload->>'delivery_zipcode') ELSE entrega_cep END,
        entrega_logradouro = CASE WHEN p_payload ? 'entrega_logradouro' OR p_payload ? 'delivery_street' THEN COALESCE(p_payload->>'entrega_logradouro', p_payload->>'delivery_street') ELSE entrega_logradouro END,
        entrega_numero = CASE WHEN p_payload ? 'entrega_numero' OR p_payload ? 'delivery_number' THEN COALESCE(p_payload->>'entrega_numero', p_payload->>'delivery_number') ELSE entrega_numero END,
        entrega_bairro = CASE WHEN p_payload ? 'entrega_bairro' OR p_payload ? 'delivery_neighborhood' THEN COALESCE(p_payload->>'entrega_bairro', p_payload->>'delivery_neighborhood') ELSE entrega_bairro END,
        entrega_complemento = CASE WHEN p_payload ? 'entrega_complemento' OR p_payload ? 'delivery_complement' THEN COALESCE(p_payload->>'entrega_complemento', p_payload->>'delivery_complement') ELSE entrega_complemento END,
        entrega_cidade = CASE WHEN p_payload ? 'entrega_cidade' OR p_payload ? 'delivery_city' THEN COALESCE(p_payload->>'entrega_cidade', p_payload->>'delivery_city') ELSE entrega_cidade END,
        entrega_uf = CASE WHEN p_payload ? 'entrega_uf' OR p_payload ? 'delivery_state' THEN COALESCE(p_payload->>'entrega_uf', p_payload->>'delivery_state') ELSE entrega_uf END,
        cd_vend = CASE WHEN p_payload ? 'cd_vend' THEN p_payload->>'cd_vend' ELSE cd_vend END,
        tab_pre = CASE WHEN p_payload ? 'tab_pre' THEN p_payload->>'tab_pre' ELSE tab_pre END,
        tp_ped = CASE WHEN p_payload ? 'tp_ped' THEN p_payload->>'tp_ped' ELSE tp_ped END,
        status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE status END,
        observacoes = CASE WHEN p_payload ? 'observacoes' OR p_payload ? 'notes' THEN COALESCE(p_payload->>'observacoes', p_payload->>'notes') ELSE observacoes END
    WHERE id = p_client_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado.');
    END IF;

    RETURN jsonb_build_object('success', true, 'data', to_jsonb(v_updated));
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.update_novo_cliente_profile(UUID, JSONB) TO anon, authenticated, service_role;
