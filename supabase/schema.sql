-- ==============================================================================
-- SCHEMA SUPABASE: SISTEMA DE CADASTRO DE CLIENTES VETLINE
-- Schema: novo_cliente (Tabela Principal: data_new_cliente)
-- Schema: public (Tabela de Vendedores: vendedor, admin_profiles)
-- ==============================================================================

-- 1. Criação e Configuração do Schema NOVO_CLIENTE
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Criação da tabela principal data_new_cliente no schema NOVO_CLIENTE (Nomes em Português BR)
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
    
    -- Dados Comerciais e Faturamento (Padrão: 'VTL01')
    tab_pre VARCHAR(50) DEFAULT 'VTL01',
    tp_ped VARCHAR(50) DEFAULT 'VTL01',
    
    -- URLs dos Documentos Anexados & Bucket Dedicado (Supabase Storage)
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

-- View de compatibilidade com data_new_client
CREATE OR REPLACE VIEW novo_cliente.data_new_client AS
SELECT * FROM novo_cliente.data_new_cliente;

-- Permissões na tabela novo_cliente.data_new_cliente
GRANT ALL ON TABLE novo_cliente.data_new_cliente TO authenticated, anon, service_role;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_data_new_cliente_doc ON novo_cliente.data_new_cliente (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_data_new_cliente_email ON novo_cliente.data_new_cliente (email);
CREATE INDEX IF NOT EXISTS idx_data_new_cliente_auth_user ON novo_cliente.data_new_cliente (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_data_new_cliente_status ON novo_cliente.data_new_cliente (status);
CREATE INDEX IF NOT EXISTS idx_data_new_cliente_criado_em ON novo_cliente.data_new_cliente (criado_em DESC);

-- Habilitação de Segurança por Linhas (RLS)
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;
CREATE POLICY "Permitir inserção de novo cadastro publicamente" 
ON novo_cliente.data_new_cliente FOR INSERT 
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_cliente;
CREATE POLICY "Permitir leitura de clientes" 
ON novo_cliente.data_new_cliente FOR SELECT 
TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS "Permitir atualização de clientes" ON novo_cliente.data_new_cliente;
CREATE POLICY "Permitir atualização de clientes" 
ON novo_cliente.data_new_cliente FOR UPDATE 
TO authenticated, anon, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de clientes" ON novo_cliente.data_new_cliente;
CREATE POLICY "Permitir exclusão de clientes" 
ON novo_cliente.data_new_cliente FOR DELETE 
TO authenticated, service_role USING (true);

-- Permissões de leitura e política RLS para tabela public.vendedor (já existente no schema public)
GRANT SELECT ON TABLE public.vendedor TO anon, authenticated, service_role;
ALTER TABLE public.vendedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de vendedores" ON public.vendedor;
CREATE POLICY "Permitir leitura de vendedores" 
ON public.vendedor FOR SELECT 
TO anon, authenticated, service_role USING (true);

-- ==============================================================================
-- 2. BUCKET DE ARMAZENAMENTO (Storage): novos_clientes
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'novos_clientes', 
    'novos_clientes', 
    true, 
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permitir upload publico em novos_clientes" ON storage.objects;
CREATE POLICY "Permitir upload publico em novos_clientes"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'novos_clientes');

DROP POLICY IF EXISTS "Permitir visualizacao em novos_clientes" ON storage.objects;
CREATE POLICY "Permitir visualizacao em novos_clientes"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'novos_clientes');

-- ==============================================================================
-- 3. GESTÃO DE USUÁRIOS & PERFIS ADMINISTRATIVOS (novo_cliente.admin_profiles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS novo_cliente.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'bloqueado' CHECK (role IN ('admin', 'operador', 'consulta', 'bloqueado')),
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT ALL ON TABLE novo_cliente.admin_profiles TO authenticated, anon, service_role;
ALTER TABLE novo_cliente.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON novo_cliente.admin_profiles;
CREATE POLICY "Permitir leitura de perfis para todos" 
ON novo_cliente.admin_profiles FOR SELECT 
TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de perfis" ON novo_cliente.admin_profiles;
CREATE POLICY "Permitir gerenciamento de perfis" 
ON novo_cliente.admin_profiles FOR ALL 
TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- ==============================================================================
-- 4. FUNÇÕES RPC (SECURITY DEFINER) DIRETAS PARA O SCHEMA NOVO_CLIENTE
-- ==============================================================================

-- 4.1 Inserção Direta no schema NOVO_CLIENTE.DATA_NEW_CLIENT
CREATE OR REPLACE FUNCTION public.insert_novo_cliente(client_payload JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
DECLARE
    v_inserted novo_cliente.data_new_client%ROWTYPE;
BEGIN
    INSERT INTO novo_cliente.data_new_client (
        person_type,
        document_number,
        full_name,
        trade_name,
        has_ie,
        ie_number,
        phone,
        segment,
        email,
        zipcode,
        street,
        number,
        neighborhood,
        complement,
        city,
        state,
        has_different_delivery_address,
        delivery_zipcode,
        delivery_street,
        delivery_number,
        delivery_neighborhood,
        delivery_complement,
        delivery_city,
        delivery_state,
        cd_vend,
        tab_pre,
        tp_ped,
        storage_bucket,
        doc_ie_url,
        doc_contract_url,
        doc_address_url,
        doc_photo_id_url,
        doc_crmv_url,
        status,
        terms_accepted,
        auth_user_id
    ) VALUES (
        COALESCE(client_payload->>'person_type', 'PJ'),
        COALESCE(client_payload->>'document_number', ''),
        COALESCE(client_payload->>'full_name', ''),
        client_payload->>'trade_name',
        COALESCE((client_payload->>'has_ie')::BOOLEAN, false),
        client_payload->>'ie_number',
        COALESCE(client_payload->>'phone', ''),
        COALESCE(client_payload->>'segment', ''),
        COALESCE(client_payload->>'email', ''),
        client_payload->>'zipcode',
        client_payload->>'street',
        client_payload->>'number',
        client_payload->>'neighborhood',
        client_payload->>'complement',
        client_payload->>'city',
        client_payload->>'state',
        COALESCE((client_payload->>'has_different_delivery_address')::BOOLEAN, false),
        client_payload->>'delivery_zipcode',
        client_payload->>'delivery_street',
        client_payload->>'delivery_number',
        client_payload->>'delivery_neighborhood',
        client_payload->>'delivery_complement',
        client_payload->>'delivery_city',
        client_payload->>'delivery_state',
        COALESCE(client_payload->>'cd_vend', 'ATENA'),
        COALESCE(client_payload->>'tab_pre', 'VTL01'),
        COALESCE(client_payload->>'tp_ped', 'VTL01'),
        COALESCE(client_payload->>'storage_bucket', 'novos_clientes'),
        client_payload->>'doc_ie_url',
        client_payload->>'doc_contract_url',
        client_payload->>'doc_address_url',
        client_payload->>'doc_photo_id_url',
        client_payload->>'doc_crmv_url',
        COALESCE(client_payload->>'status', 'pendente'),
        COALESCE((client_payload->>'terms_accepted')::BOOLEAN, true),
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

-- 4.2 Listagem dos clientes do schema NOVO_CLIENTE
CREATE OR REPLACE FUNCTION public.get_novo_cliente_clients(
    p_status VARCHAR DEFAULT NULL,
    p_search VARCHAR DEFAULT NULL
)
RETURNS SETOF novo_cliente.data_new_client
SECURITY DEFINER
SET search_path = novo_cliente, public
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM novo_cliente.data_new_client c
    WHERE (p_status IS NULL OR p_status = '' OR p_status = 'todos' OR c.status = p_status)
      AND (p_search IS NULL OR p_search = '' OR 
           c.full_name ILIKE '%' || p_search || '%' OR
           c.trade_name ILIKE '%' || p_search || '%' OR
           c.document_number ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           c.phone ILIKE '%' || p_search || '%' OR
           c.city ILIKE '%' || p_search || '%')
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_novo_cliente_clients(VARCHAR, VARCHAR) TO anon, authenticated, service_role;

-- 4.3 Atualização dos dados no schema NOVO_CLIENTE
CREATE OR REPLACE FUNCTION public.update_novo_cliente(
    p_client_id UUID,
    p_payload JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public
AS $$
DECLARE
    v_updated novo_cliente.data_new_client%ROWTYPE;
BEGIN
    UPDATE novo_cliente.data_new_client
    SET
        full_name = COALESCE(p_payload->>'full_name', full_name),
        trade_name = COALESCE(p_payload->>'trade_name', trade_name),
        phone = COALESCE(p_payload->>'phone', phone),
        email = COALESCE(p_payload->>'email', email),
        segment = COALESCE(p_payload->>'segment', segment),
        zipcode = COALESCE(p_payload->>'zipcode', zipcode),
        street = COALESCE(p_payload->>'street', street),
        number = COALESCE(p_payload->>'number', number),
        neighborhood = COALESCE(p_payload->>'neighborhood', neighborhood),
        complement = COALESCE(p_payload->>'complement', complement),
        city = COALESCE(p_payload->>'city', city),
        state = COALESCE(p_payload->>'state', state),
        has_different_delivery_address = COALESCE((p_payload->>'has_different_delivery_address')::BOOLEAN, has_different_delivery_address),
        delivery_zipcode = COALESCE(p_payload->>'delivery_zipcode', delivery_zipcode),
        delivery_street = COALESCE(p_payload->>'delivery_street', delivery_street),
        delivery_number = COALESCE(p_payload->>'delivery_number', delivery_number),
        delivery_neighborhood = COALESCE(p_payload->>'delivery_neighborhood', delivery_neighborhood),
        delivery_complement = COALESCE(p_payload->>'delivery_complement', delivery_complement),
        delivery_city = COALESCE(p_payload->>'delivery_city', delivery_city),
        delivery_state = COALESCE(p_payload->>'delivery_state', delivery_state),
        cd_vend = COALESCE(p_payload->>'cd_vend', cd_vend),
        tab_pre = COALESCE(p_payload->>'tab_pre', tab_pre),
        tp_ped = COALESCE(p_payload->>'tp_ped', tp_ped),
        doc_contract_url = COALESCE(p_payload->>'doc_contract_url', doc_contract_url),
        doc_photo_id_url = COALESCE(p_payload->>'doc_photo_id_url', doc_photo_id_url),
        doc_crmv_url = COALESCE(p_payload->>'doc_crmv_url', doc_crmv_url),
        doc_address_url = COALESCE(p_payload->>'doc_address_url', doc_address_url),
        doc_ie_url = COALESCE(p_payload->>'doc_ie_url', doc_ie_url),
        status = COALESCE(p_payload->>'status', status),
        notes = COALESCE(p_payload->>'notes', notes),
        auth_user_id = CASE 
            WHEN p_payload->>'auth_user_id' IS NOT NULL AND p_payload->>'auth_user_id' ~* '^[0-9a-fA-F-]{36}$'
            THEN (p_payload->>'auth_user_id')::UUID 
            ELSE auth_user_id 
        END
    WHERE id = p_client_id
    RETURNING * INTO v_updated;

    RETURN to_jsonb(v_updated);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.update_novo_cliente(UUID, JSONB) TO anon, authenticated, service_role;

-- 4.4 Busca de um cliente específico por Auth User ID ou E-mail
CREATE OR REPLACE FUNCTION public.get_novo_cliente_by_user_or_email(
    p_user_id UUID DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public
AS $$
DECLARE
    v_client novo_cliente.data_new_client%ROWTYPE;
BEGIN
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_client
        FROM novo_cliente.data_new_client
        WHERE auth_user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_client.id IS NULL AND p_email IS NOT NULL AND p_email <> '' THEN
        SELECT * INTO v_client
        FROM novo_cliente.data_new_client
        WHERE lower(email) = lower(trim(p_email))
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_client.id IS NOT NULL THEN
        RETURN to_jsonb(v_client);
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_novo_cliente_by_user_or_email(UUID, VARCHAR) TO anon, authenticated, service_role;

-- 4.5 Exclusão Segura no schema NOVO_CLIENTE
CREATE OR REPLACE FUNCTION public.delete_novo_cliente(
    p_client_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = novo_cliente, public
AS $$
BEGIN
    DELETE FROM novo_cliente.data_new_client WHERE id = p_client_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.delete_novo_cliente(UUID) TO anon, authenticated, service_role;

-- 4.6 Garantir ou Vincular Usuário no Supabase Auth (sem conflitos com outros sistemas)
CREATE OR REPLACE FUNCTION public.ensure_client_auth_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_clean_email TEXT;
BEGIN
    v_clean_email := lower(trim(p_email));
    
    -- 1. Verifica se já existe um usuário com este e-mail em auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Se a senha foi informada, atualiza para que o cliente consiga logar
        IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
            v_encrypted_pw := crypt(p_password, gen_salt('bf'));
            
            UPDATE auth.users
            SET 
                encrypted_password = v_encrypted_pw,
                raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', COALESCE(p_full_name, raw_user_meta_data->>'full_name')),
                email_confirmed_at = COALESCE(email_confirmed_at, now()),
                updated_at = now()
            WHERE id = v_user_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'user_id', v_user_id,
            'is_existing', true,
            'message', 'Usuário existente em auth.users vinculado com sucesso.'
        );
    ELSE
        -- 2. Cria o novo usuário em auth.users
        v_user_id := gen_random_uuid();
        v_encrypted_pw := crypt(p_password, gen_salt('bf'));
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_clean_email,
            v_encrypted_pw,
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', p_full_name, 'role', 'cliente'),
            now(),
            now()
        );

        -- Cria registro correspondente em auth.identities
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                identity_data,
                provider,
                provider_id,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                v_user_id,
                v_user_id,
                jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
                'email',
                v_clean_email,
                now(),
                now(),
                now()
            ) ON CONFLICT (provider, provider_id) DO NOTHING;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'user_id', v_user_id,
            'is_existing', false,
            'message', 'Novo usuário criado no auth.users com sucesso.'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.ensure_client_auth_user(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4.7 Listagem de Usuários Auth com Perfis
CREATE OR REPLACE FUNCTION public.list_auth_users_with_profiles()
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    full_name VARCHAR,
    role VARCHAR,
    is_admin BOOLEAN,
    has_profile BOOLEAN
) 
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::VARCHAR,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name')::VARCHAR, split_part(u.email, '@', 1)::VARCHAR) AS full_name,
    COALESCE(p.role, 'bloqueado')::VARCHAR AS role,
    COALESCE(p.is_admin, (p.role = 'admin'), false) AS is_admin,
    (p.id IS NOT NULL) AS has_profile
  FROM auth.users u
  LEFT JOIN novo_cliente.admin_profiles p ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.list_auth_users_with_profiles() TO authenticated, anon, service_role;

-- 4.7 Conceder Perfil por ID
CREATE OR REPLACE FUNCTION public.set_user_role(
    p_user_id UUID,
    p_role VARCHAR,
    p_full_name VARCHAR DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
DECLARE
    v_email VARCHAR;
    v_user_name VARCHAR;
    v_is_admin BOOLEAN;
BEGIN
    SELECT u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
    INTO v_email, v_user_name
    FROM auth.users u
    WHERE u.id = p_user_id;

    IF v_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado em auth.users');
    END IF;

    v_is_admin := (p_role = 'admin');
    IF p_full_name IS NOT NULL AND p_full_name <> '' THEN
        v_user_name := p_full_name;
    END IF;

    INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin, updated_at)
    VALUES (p_user_id, v_email, v_user_name, p_role, v_is_admin, now())
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, novo_cliente.admin_profiles.full_name),
        role = EXCLUDED.role,
        is_admin = EXCLUDED.is_admin,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true, 
        'id', p_user_id, 
        'email', v_email, 
        'full_name', v_user_name,
        'role', p_role, 
        'is_admin', v_is_admin
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, VARCHAR, VARCHAR) TO authenticated, anon, service_role;

-- 4.8 Conceder Perfil por E-mail
CREATE OR REPLACE FUNCTION public.grant_role_by_email(
    p_email VARCHAR,
    p_role VARCHAR DEFAULT 'admin',
    p_full_name VARCHAR DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = novo_cliente, public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_clean_email VARCHAR;
BEGIN
    v_clean_email := lower(trim(p_email));

    SELECT u.id INTO v_user_id
    FROM auth.users u
    WHERE lower(u.email) = v_clean_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Nenhum usuário com o e-mail "' || p_email || '" foi encontrado no Supabase Auth.'
        );
    END IF;

    RETURN public.set_user_role(v_user_id, p_role, p_full_name);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.grant_role_by_email(VARCHAR, VARCHAR, VARCHAR) TO authenticated, anon, service_role;

-- 5. Trigger para novos usuários criados no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'bloqueado',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
