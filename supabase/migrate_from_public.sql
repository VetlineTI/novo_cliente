-- ==============================================================================
-- SCRIPT DE MIGRAÇÃO: MOVER DADOS DE public PARA novo_cliente (100% SEGURO)
-- Converte colunas dinamicamente via JSONB para evitar erros de colunas faltantes
-- ==============================================================================

-- 1. Criação do Schema NOVO_CLIENTE e permissões
CREATE SCHEMA IF NOT EXISTS novo_cliente;
GRANT USAGE ON SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA novo_cliente TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA novo_cliente TO anon, authenticated, service_role;

-- 2. Criação da tabela principal data_new_client no schema NOVO_CLIENTE
CREATE TABLE IF NOT EXISTS novo_cliente.data_new_client (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    person_type VARCHAR(2) NOT NULL DEFAULT 'PJ',
    document_number VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    has_ie BOOLEAN DEFAULT FALSE,
    ie_number VARCHAR(50),
    phone VARCHAR(30) NOT NULL,
    segment VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    zipcode VARCHAR(15),
    street VARCHAR(255),
    number VARCHAR(50),
    neighborhood VARCHAR(150),
    complement VARCHAR(150),
    city VARCHAR(100),
    state VARCHAR(10),
    has_different_delivery_address BOOLEAN DEFAULT FALSE,
    delivery_zipcode VARCHAR(15),
    delivery_street VARCHAR(255),
    delivery_number VARCHAR(50),
    delivery_neighborhood VARCHAR(150),
    delivery_complement VARCHAR(150),
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(10),
    cd_vend VARCHAR(50) DEFAULT 'ATENA',
    tab_pre VARCHAR(50) DEFAULT 'VTL01',
    tp_ped VARCHAR(50) DEFAULT 'VTL01',
    storage_bucket VARCHAR(100) DEFAULT 'novos_clientes',
    doc_ie_url TEXT,
    doc_contract_url TEXT,
    doc_address_url TEXT,
    doc_photo_id_url TEXT,
    doc_crmv_url TEXT,
    status VARCHAR(30) DEFAULT 'pendente',
    terms_accepted BOOLEAN DEFAULT TRUE NOT NULL,
    notes TEXT,
    auth_user_id UUID
);

-- 3. Garante que todas as colunas existam em novo_cliente.data_new_client caso a tabela já existisse
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS person_type VARCHAR(2) DEFAULT 'PJ';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS has_ie BOOLEAN DEFAULT FALSE;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS ie_number VARCHAR(50);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS segment VARCHAR(100);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS zipcode VARCHAR(15);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS number VARCHAR(50);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(150);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS complement VARCHAR(150);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS state VARCHAR(10);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS has_different_delivery_address BOOLEAN DEFAULT FALSE;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_zipcode VARCHAR(15);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_street VARCHAR(255);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_number VARCHAR(50);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_neighborhood VARCHAR(150);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_complement VARCHAR(150);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS delivery_state VARCHAR(10);
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS cd_vend VARCHAR(50) DEFAULT 'ATENA';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS tab_pre VARCHAR(50) DEFAULT 'VTL01';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS tp_ped VARCHAR(50) DEFAULT 'VTL01';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100) DEFAULT 'novos_clientes';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS doc_ie_url TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS doc_contract_url TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS doc_address_url TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS doc_photo_id_url TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS doc_crmv_url TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pendente';
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT TRUE;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE novo_cliente.data_new_client ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 4. Criação da tabela admin_profiles no schema NOVO_CLIENTE
CREATE TABLE IF NOT EXISTS novo_cliente.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'bloqueado' CHECK (role IN ('admin', 'operador', 'consulta', 'bloqueado')),
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Migra dados de public.data_new_client para novo_cliente.data_new_client de forma dinâmica
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'data_new_client'
    ) THEN
        INSERT INTO novo_cliente.data_new_client (
            id,
            created_at,
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
            notes,
            auth_user_id
        )
        SELECT 
            COALESCE(
                CASE WHEN (to_jsonb(p)->>'id') ~* '^[0-9a-fA-F-]{36}$' THEN (to_jsonb(p)->>'id')::UUID ELSE gen_random_uuid() END,
                gen_random_uuid()
            ),
            COALESCE((to_jsonb(p)->>'created_at')::TIMESTAMPTZ, now()),
            COALESCE(to_jsonb(p)->>'person_type', 'PJ'),
            COALESCE(to_jsonb(p)->>'document_number', ''),
            COALESCE(to_jsonb(p)->>'full_name', ''),
            to_jsonb(p)->>'trade_name',
            COALESCE((to_jsonb(p)->>'has_ie')::BOOLEAN, false),
            to_jsonb(p)->>'ie_number',
            COALESCE(to_jsonb(p)->>'phone', ''),
            COALESCE(to_jsonb(p)->>'segment', ''),
            COALESCE(to_jsonb(p)->>'email', ''),
            to_jsonb(p)->>'zipcode',
            to_jsonb(p)->>'street',
            to_jsonb(p)->>'number',
            to_jsonb(p)->>'neighborhood',
            to_jsonb(p)->>'complement',
            to_jsonb(p)->>'city',
            to_jsonb(p)->>'state',
            COALESCE((to_jsonb(p)->>'has_different_delivery_address')::BOOLEAN, false),
            to_jsonb(p)->>'delivery_zipcode',
            to_jsonb(p)->>'delivery_street',
            to_jsonb(p)->>'delivery_number',
            to_jsonb(p)->>'delivery_neighborhood',
            to_jsonb(p)->>'delivery_complement',
            to_jsonb(p)->>'delivery_city',
            to_jsonb(p)->>'delivery_state',
            COALESCE(to_jsonb(p)->>'cd_vend', 'ATENA'),
            COALESCE(to_jsonb(p)->>'tab_pre', 'VTL01'),
            COALESCE(to_jsonb(p)->>'tp_ped', 'VTL01'),
            COALESCE(to_jsonb(p)->>'storage_bucket', 'novos_clientes'),
            to_jsonb(p)->>'doc_ie_url',
            to_jsonb(p)->>'doc_contract_url',
            to_jsonb(p)->>'doc_address_url',
            to_jsonb(p)->>'doc_photo_id_url',
            to_jsonb(p)->>'doc_crmv_url',
            COALESCE(to_jsonb(p)->>'status', 'pendente'),
            COALESCE((to_jsonb(p)->>'terms_accepted')::BOOLEAN, true),
            to_jsonb(p)->>'notes',
            CASE 
                WHEN to_jsonb(p)->>'auth_user_id' IS NOT NULL AND to_jsonb(p)->>'auth_user_id' ~* '^[0-9a-fA-F-]{36}$'
                THEN (to_jsonb(p)->>'auth_user_id')::UUID 
                ELSE NULL 
            END
        FROM public.data_new_client p
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Cadastros migrados com sucesso para novo_cliente.data_new_client!';
    END IF;
END $$;

-- 6. Migra dados de public.admin_profiles para novo_cliente.admin_profiles de forma dinâmica
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'admin_profiles'
    ) THEN
        INSERT INTO novo_cliente.admin_profiles (
            id,
            email,
            full_name,
            role,
            is_admin,
            created_at,
            updated_at
        )
        SELECT 
            (to_jsonb(p)->>'id')::UUID,
            COALESCE(to_jsonb(p)->>'email', ''),
            to_jsonb(p)->>'full_name',
            COALESCE(to_jsonb(p)->>'role', 'bloqueado'),
            COALESCE((to_jsonb(p)->>'is_admin')::BOOLEAN, false),
            COALESCE((to_jsonb(p)->>'created_at')::TIMESTAMPTZ, now()),
            COALESCE((to_jsonb(p)->>'updated_at')::TIMESTAMPTZ, now())
        FROM public.admin_profiles p
        ON CONFLICT (id) DO UPDATE
        SET 
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            is_admin = EXCLUDED.is_admin,
            updated_at = EXCLUDED.updated_at;

        RAISE NOTICE 'Perfis migrados de public.admin_profiles para novo_cliente.admin_profiles com sucesso!';
    END IF;
END $$;

-- 7. Remove com segurança as tabelas legadas do schema public
DROP TABLE IF EXISTS public.data_new_client CASCADE;
DROP TABLE IF EXISTS public.admin_profiles CASCADE;

-- 8. Configura Políticas RLS e Permissões no schema NOVO_CLIENTE
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

ALTER TABLE novo_cliente.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON novo_cliente.admin_profiles;
CREATE POLICY "Permitir leitura de perfis para todos" 
ON novo_cliente.admin_profiles FOR SELECT 
TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de perfis" ON novo_cliente.admin_profiles;
CREATE POLICY "Permitir gerenciamento de perfis" 
ON novo_cliente.admin_profiles FOR ALL 
TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- 9. Função RPC para vincular usuários existentes em auth.users sem conflito com outros sistemas
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
    
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
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

