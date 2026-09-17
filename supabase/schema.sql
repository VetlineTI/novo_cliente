-- ==============================================================================
-- SCHEMA SUPABASE: SISTEMA DE CADASTRO DE CLIENTES VETLINE
-- Schema: novo_cliente (Tabela Principal: data_new_client)
-- Schema: public (Tabela de Vendedores: vendedor)
-- ==============================================================================

-- 1. Criação e Configuração do Schema NOVO_CLIENTE
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Criação da tabela principal data_new_client no schema NOVO_CLIENTE
CREATE TABLE IF NOT EXISTS novo_cliente.data_new_client (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Tipo de Pessoa ('PJ' para Jurídica, 'PF' para Física)
    person_type VARCHAR(2) NOT NULL CHECK (person_type IN ('PJ', 'PF')),
    
    -- Documento Principal (CNPJ formatado/limpo ou CPF formatado/limpo)
    document_number VARCHAR(20) NOT NULL,
    
    -- Nome Completo (PF) ou Razão Social (PJ)
    full_name VARCHAR(255) NOT NULL,
    
    -- Nome Fantasia (opcional para PJ)
    trade_name VARCHAR(255),
    
    -- Inscrição Estadual (Apenas PJ)
    has_ie BOOLEAN DEFAULT FALSE,
    ie_number VARCHAR(50),
    
    -- Contato
    phone VARCHAR(30) NOT NULL,
    segment VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Endereço de entrega alternativo (quando diferente do comprovante)
    has_different_delivery_address BOOLEAN DEFAULT FALSE,
    delivery_zipcode VARCHAR(15),
    delivery_street VARCHAR(255),
    delivery_number VARCHAR(50),
    delivery_neighborhood VARCHAR(150),
    delivery_complement VARCHAR(150),
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(10),
    
    -- Vendedor Responsável (Código cd_vend ou 'ATENA' caso não tenha sido atendido)
    cd_vend VARCHAR(50) DEFAULT 'ATENA',
    
    -- Dados Comerciais e Faturamento (Padrão: 'VTL01')
    tab_pre VARCHAR(50) DEFAULT 'VTL01',
    tp_ped VARCHAR(50) DEFAULT 'VTL01',
    
    -- URLs dos Documentos Anexados & Bucket Dedicado (Supabase Storage)
    storage_bucket VARCHAR(100) DEFAULT 'novos_clientes',
    doc_ie_url TEXT,
    doc_contract_url TEXT,
    doc_address_url TEXT,
    doc_photo_id_url TEXT,
    doc_crmv_url TEXT,
    
    -- Status do Cadastro
    status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'recusado')),
    terms_accepted BOOLEAN DEFAULT TRUE NOT NULL,
    notes TEXT
);

-- Garantir adição de colunas no schema novo_cliente caso já exista
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS doc_crmv_url TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS cd_vend VARCHAR(50) DEFAULT 'ATENA';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS tab_pre VARCHAR(50) DEFAULT 'VTL01';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS tp_ped VARCHAR(50) DEFAULT 'VTL01';

-- Garantir adição de colunas também se a tabela estiver no schema public
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_new_client') THEN
        ALTER TABLE public.data_new_client ADD COLUMN IF NOT EXISTS doc_crmv_url TEXT;
        ALTER TABLE public.data_new_client ADD COLUMN IF NOT EXISTS cd_vend VARCHAR(50) DEFAULT 'ATENA';
        ALTER TABLE public.data_new_client ADD COLUMN IF NOT EXISTS tab_pre VARCHAR(50) DEFAULT 'VTL01';
        ALTER TABLE public.data_new_client ADD COLUMN IF NOT EXISTS tp_ped VARCHAR(50) DEFAULT 'VTL01';
    END IF;
END $$;

-- Permissões de leitura e política RLS para tabela public.vendedor (já existente no schema public)
GRANT SELECT ON TABLE public.vendedor TO anon, authenticated, service_role;
ALTER TABLE public.vendedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de vendedores" ON public.vendedor;
CREATE POLICY "Permitir leitura de vendedores" 
ON public.vendedor FOR SELECT 
TO anon, authenticated, service_role USING (true);

-- Permissões na tabela novo_cliente.data_new_client
GRANT INSERT ON TABLE novo_cliente.data_new_client TO anon;
GRANT ALL ON TABLE novo_cliente.data_new_client TO authenticated, anon, service_role;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_data_new_client_doc ON novo_cliente.data_new_client (document_number);
CREATE INDEX IF NOT EXISTS idx_data_new_client_email ON novo_cliente.data_new_client (email);
CREATE INDEX IF NOT EXISTS idx_data_new_client_status ON novo_cliente.data_new_client (status);
CREATE INDEX IF NOT EXISTS idx_data_new_client_created_at ON novo_cliente.data_new_client (created_at DESC);

-- Habilitação de Segurança por Linhas (RLS)
ALTER TABLE novo_cliente.data_new_client ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_client;
CREATE POLICY "Permitir inserção de novo cadastro publicamente" 
ON novo_cliente.data_new_client FOR INSERT 
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_client;
CREATE POLICY "Permitir leitura de clientes" 
ON novo_cliente.data_new_client FOR SELECT 
TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS "Permitir atualização de clientes" ON novo_cliente.data_new_client;
CREATE POLICY "Permitir atualização de clientes" 
ON novo_cliente.data_new_client FOR UPDATE 
TO authenticated, anon, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de clientes" ON novo_cliente.data_new_client;
CREATE POLICY "Permitir exclusão de clientes" 
ON novo_cliente.data_new_client FOR DELETE 
TO authenticated, service_role USING (true);

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
-- 3. GESTÃO DE USUÁRIOS & PERFIS ADMINISTRATIVOS (admin_profiles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'bloqueado' CHECK (role IN ('admin', 'operador', 'consulta', 'bloqueado')),
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT ALL ON TABLE public.admin_profiles TO authenticated, anon, service_role;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON public.admin_profiles;
CREATE POLICY "Permitir leitura de perfis para todos" 
ON public.admin_profiles FOR SELECT 
TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de perfis" ON public.admin_profiles;
CREATE POLICY "Permitir gerenciamento de perfis" 
ON public.admin_profiles FOR ALL 
TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- ==============================================================================
-- 4. FUNÇÕES RPC (SECURITY DEFINER) PARA CONSULTAR E GERENCIAR AUTH.USERS
-- ==============================================================================

-- Função para listar todos os usuários de auth.users com seus respectivos perfis
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
SET search_path = public, auth
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
  LEFT JOIN public.admin_profiles p ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.list_auth_users_with_profiles() TO authenticated, anon, service_role;

-- Função para conceder ou alterar o perfil de um usuário (por ID)
CREATE OR REPLACE FUNCTION public.set_user_role(
    p_user_id UUID,
    p_role VARCHAR,
    p_full_name VARCHAR DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
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

    INSERT INTO public.admin_profiles (id, email, full_name, role, is_admin, updated_at)
    VALUES (p_user_id, v_email, v_user_name, p_role, v_is_admin, now())
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.admin_profiles.full_name),
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

-- Função para conceder perfil pelo E-MAIL
CREATE OR REPLACE FUNCTION public.grant_role_by_email(
    p_email VARCHAR,
    p_role VARCHAR DEFAULT 'admin',
    p_full_name VARCHAR DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
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

-- 5. Trigger para novos usuários criados no auth.users (Padrão: BLOQUEADO / SEM ACESSO)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, email, full_name, role, is_admin)
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

-- ==============================================================================
-- 6. COMANDO PARA RESETAR TODOS OS USUÁRIOS PARA "SEM ACESSO" (PADRÃO BLOQUEADO)
-- ==============================================================================
-- Todos os usuários do auth.users são vinculados como 'bloqueado' (Sem Acesso)
-- O Administrador poderá entrar no painel e clicar em "Dar Perfil ADM" para os escolhidos.
INSERT INTO public.admin_profiles (id, email, full_name, role, is_admin)
SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 
    'bloqueado', 
    false
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET is_admin = false, role = 'bloqueado';
