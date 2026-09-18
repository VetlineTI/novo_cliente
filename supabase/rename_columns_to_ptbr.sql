-- ==============================================================================
-- MIGRAÇÃO DE COLUNAS PARA PORTUGUÊS (PT-BR) NO SCHEMA NOVO_CLIENTE
-- Tabela: novo_cliente.data_new_cliente
-- ==============================================================================

-- 1. Garante a existência do schema novo_cliente
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Se a tabela antiga data_new_client existir e data_new_cliente não existir, renomeia a tabela
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente') THEN
    ALTER TABLE novo_cliente.data_new_client RENAME TO data_new_cliente;
  END IF;
END $$;

-- 3. Caso a tabela ainda não exista, cria com os nomes em Português
CREATE TABLE IF NOT EXISTS novo_cliente.data_new_cliente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Tipo de Pessoa ('PJ' para Jurídica, 'PF' para Física)
    tipo_pessoa VARCHAR(2) NOT NULL CHECK (tipo_pessoa IN ('PJ', 'PF')),
    
    -- Documento Principal (CNPJ ou CPF)
    cpf_cnpj VARCHAR(20) NOT NULL,
    
    -- Nome Completo (PF) ou Razão Social (PJ)
    razao_social_nome VARCHAR(255) NOT NULL,
    
    -- Nome Fantasia (opcional para PJ)
    nome_fantasia VARCHAR(255),
    
    -- Inscrição Estadual (Apenas PJ)
    possui_ie BOOLEAN DEFAULT FALSE,
    numero_ie VARCHAR(50),
    
    -- Contato
    telefone VARCHAR(30) NOT NULL,
    segmento VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,

    -- Endereço Principal / Cadastral
    cep VARCHAR(15),
    logradouro VARCHAR(255),
    numero VARCHAR(50),
    bairro VARCHAR(150),
    complemento VARCHAR(150),
    cidade VARCHAR(100),
    uf VARCHAR(10),
    
    -- Endereço de entrega alternativo
    endereco_entrega_diferente BOOLEAN DEFAULT FALSE,
    entrega_cep VARCHAR(15),
    entrega_logradouro VARCHAR(255),
    entrega_numero VARCHAR(50),
    entrega_bairro VARCHAR(150),
    entrega_complemento VARCHAR(150),
    entrega_cidade VARCHAR(100),
    entrega_uf VARCHAR(10),
    
    -- Vendedor Responsável (Código cd_vend ou 'ATENA')
    cd_vend VARCHAR(50) DEFAULT 'ATENA',
    
    -- Dados Comerciais e Faturamento
    tab_pre VARCHAR(50) DEFAULT 'VTL01',
    tp_ped VARCHAR(50) DEFAULT 'VTL01',
    
    -- URLs dos Documentos Anexados & Bucket Dedicado
    storage_bucket VARCHAR(100) DEFAULT 'novos_clientes',
    doc_ie_url TEXT,
    doc_contrato_social_url TEXT,
    doc_comprovante_endereco_url TEXT,
    doc_identificacao_url TEXT,
    doc_crmv_url TEXT,
    
    -- Status do Cadastro
    status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'recusado')),
    termos_aceitos BOOLEAN DEFAULT TRUE NOT NULL,
    observacoes TEXT,

    -- Vínculo com usuário Supabase Auth (auth.users)
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. Renomeia colunas que possam estar em inglês para Português (PT-BR) com segurança
DO $$
BEGIN
  -- created_at -> criado_em
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'created_at') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN created_at TO criado_em;
  END IF;

  -- person_type -> tipo_pessoa
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'person_type') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN person_type TO tipo_pessoa;
  END IF;

  -- document_number -> cpf_cnpj
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'document_number') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN document_number TO cpf_cnpj;
  END IF;

  -- full_name -> razao_social_nome
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'full_name') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN full_name TO razao_social_nome;
  END IF;

  -- trade_name -> nome_fantasia
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'trade_name') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN trade_name TO nome_fantasia;
  END IF;

  -- has_ie -> possui_ie
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'has_ie') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN has_ie TO possui_ie;
  END IF;

  -- ie_number -> numero_ie
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'ie_number') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN ie_number TO numero_ie;
  END IF;

  -- phone -> telefone
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'phone') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN phone TO telefone;
  END IF;

  -- segment -> segmento
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'segment') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN segment TO segmento;
  END IF;

  -- zipcode -> cep
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'zipcode') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN zipcode TO cep;
  END IF;

  -- street -> logradouro
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'street') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN street TO logradouro;
  END IF;

  -- number -> numero
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'number') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN number TO numero;
  END IF;

  -- neighborhood -> bairro
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'neighborhood') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN neighborhood TO bairro;
  END IF;

  -- complement -> complemento
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'complement') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN complement TO complemento;
  END IF;

  -- city -> cidade
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'city') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN city TO cidade;
  END IF;

  -- state -> uf
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'state') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN state TO uf;
  END IF;

  -- has_different_delivery_address -> endereco_entrega_diferente
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'has_different_delivery_address') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN has_different_delivery_address TO endereco_entrega_diferente;
  END IF;

  -- delivery_zipcode -> entrega_cep
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_zipcode') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_zipcode TO entrega_cep;
  END IF;

  -- delivery_street -> entrega_logradouro
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_street') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_street TO entrega_logradouro;
  END IF;

  -- delivery_number -> entrega_numero
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_number') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_number TO entrega_numero;
  END IF;

  -- delivery_neighborhood -> entrega_bairro
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_neighborhood') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_neighborhood TO entrega_bairro;
  END IF;

  -- delivery_complement -> entrega_complemento
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_complement') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_complement TO entrega_complemento;
  END IF;

  -- delivery_city -> entrega_cidade
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_city') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_city TO entrega_cidade;
  END IF;

  -- delivery_state -> entrega_uf
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'delivery_state') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN delivery_state TO entrega_uf;
  END IF;

  -- doc_contract_url -> doc_contrato_social_url
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'doc_contract_url') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN doc_contract_url TO doc_contrato_social_url;
  END IF;

  -- doc_address_url -> doc_comprovante_endereco_url
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'doc_address_url') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN doc_address_url TO doc_comprovante_endereco_url;
  END IF;

  -- doc_photo_id_url -> doc_identificacao_url
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'doc_photo_id_url') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN doc_photo_id_url TO doc_identificacao_url;
  END IF;

  -- terms_accepted -> termos_aceitos
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'terms_accepted') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN terms_accepted TO termos_aceitos;
  END IF;

  -- notes -> observacoes
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_cliente' AND column_name = 'notes') THEN
    ALTER TABLE novo_cliente.data_new_cliente RENAME COLUMN notes TO observacoes;
  END IF;
END $$;

-- 5. Limpa pontuações de CPF/CNPJ, Telefone e CEP de registros existentes (somente dígitos)
UPDATE novo_cliente.data_new_cliente
SET 
  cpf_cnpj = regexp_replace(cpf_cnpj, '\D', '', 'g'),
  telefone = regexp_replace(telefone, '\D', '', 'g'),
  cep = CASE WHEN cep IS NOT NULL THEN regexp_replace(cep, '\D', '', 'g') ELSE NULL END,
  entrega_cep = CASE WHEN entrega_cep IS NOT NULL THEN regexp_replace(entrega_cep, '\D', '', 'g') ELSE NULL END;

-- 6. Cria VIEW de compatibilidade para quem consultar data_new_client
CREATE OR REPLACE VIEW novo_cliente.data_new_client AS
SELECT * FROM novo_cliente.data_new_cliente;

-- 7. Atualização das Funções RPC de CRUD

-- 7.1 RPC: Inserção de Novo Cliente (limpa pontuações de CPF/CNPJ e Celular)
CREATE OR REPLACE FUNCTION public.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
DECLARE
    v_inserted_id UUID;
    v_result JSONB;
BEGIN
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
        status,
        termos_aceitos,
        observacoes,
        auth_user_id
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
        COALESCE(client_payload->>'status', 'pendente'),
        COALESCE((client_payload->>'termos_aceitos')::boolean, (client_payload->>'terms_accepted')::boolean, true),
        COALESCE(client_payload->>'observacoes', client_payload->>'notes', NULL),
        CASE 
            WHEN client_payload->>'auth_user_id' IS NOT NULL AND client_payload->>'auth_user_id' ~ '^[0-9a-fA-F-]{36}$' 
            THEN (client_payload->>'auth_user_id')::uuid 
            ELSE NULL 
        END
    )
    RETURNING id INTO v_inserted_id;

    SELECT to_jsonb(t) INTO v_result 
    FROM novo_cliente.data_new_cliente t 
    WHERE t.id = v_inserted_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 7.2 RPC: Listagem com Filtros
CREATE OR REPLACE FUNCTION public.get_novo_cliente_clients(
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.criado_em DESC), '[]'::jsonb)
    INTO v_result
    FROM novo_cliente.data_new_cliente t
    WHERE 
        (p_status IS NULL OR p_status = 'todos' OR t.status = p_status)
        AND (
            p_search IS NULL OR p_search = '' OR
            t.razao_social_nome ILIKE '%' || p_search || '%' OR
            COALESCE(t.nome_fantasia, '') ILIKE '%' || p_search || '%' OR
            t.cpf_cnpj ILIKE '%' || regexp_replace(p_search, '\D', '', 'g') || '%' OR
            t.email ILIKE '%' || p_search || '%' OR
            t.telefone ILIKE '%' || regexp_replace(p_search, '\D', '', 'g') || '%' OR
            COALESCE(t.cidade, '') ILIKE '%' || p_search || '%' OR
            COALESCE(t.entrega_cidade, '') ILIKE '%' || p_search || '%'
        );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 7.3 RPC: Atualização de Cliente (limpa pontuações de CPF/CNPJ e Celular)
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

-- 7.4 RPC: Busca de Cliente por auth_user_id ou E-mail
CREATE OR REPLACE FUNCTION public.get_novo_cliente_by_user_or_email(
    p_user_id UUID DEFAULT NULL,
    p_email TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT to_jsonb(t) INTO v_result
    FROM novo_cliente.data_new_cliente t
    WHERE 
        (p_user_id IS NOT NULL AND t.auth_user_id = p_user_id)
        OR (p_email IS NOT NULL AND lower(trim(t.email)) = lower(trim(p_email)))
    ORDER BY t.criado_em DESC
    LIMIT 1;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 7.5 RPC: Exclusão de Cliente
CREATE OR REPLACE FUNCTION public.delete_novo_cliente(p_client_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
BEGIN
    DELETE FROM novo_cliente.data_new_cliente WHERE id = p_client_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 8. Concessão de Permissões
GRANT ALL ON TABLE novo_cliente.data_new_cliente TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_novo_cliente_clients(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_novo_cliente(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_novo_cliente_by_user_or_email(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_novo_cliente(UUID) TO anon, authenticated, service_role;

