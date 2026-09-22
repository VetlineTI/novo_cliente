-- ==============================================================================
-- CORREÇÃO DEFINITIVA DO TRIGGER DE AUTH.USERS E COMPATIBILIDADE DE ADMIN_PROFILES
-- Execute este script no SQL Editor do Supabase para destravar o cadastro e e-mails
-- ==============================================================================

-- 1. Cria uma VIEW de compatibilidade no schema public apontando para novo_cliente.admin_profiles
-- (Evita que qualquer função ou trigger legado falhe por falta de public.admin_profiles)
CREATE OR REPLACE VIEW public.admin_profiles AS 
SELECT * FROM novo_cliente.admin_profiles;

-- 2. Atualiza a função do Trigger no auth.users para ser 100% segura e tolerante a falhas
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
AS $$
BEGIN
  -- Cria perfil administrativo apenas se NÃO for um cliente comum
  IF COALESCE(NEW.raw_user_meta_data->>'role', '') <> 'cliente' THEN
    INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'bloqueado',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Garante que NUNCA bloqueie ou gere erro 500 no signUp / criação de usuários
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Reconecta o trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. Atualiza a função RPC ensure_client_auth_user para operar com total segurança
CREATE OR REPLACE FUNCTION public.ensure_client_auth_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, novo_cliente, auth, extensions
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
                email_confirmed_at = COALESCE(email_confirmed_at, now()),
                raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', COALESCE(p_full_name, raw_user_meta_data->>'full_name'), 'role', 'cliente'),
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
        -- 2. Cria o novo usuário em auth.users com confirmação imediata
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
            now(), -- Ativação direta sem dependência de envio de e-mail do Supabase
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
            ) ON CONFLICT DO NOTHING;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'user_id', v_user_id,
            'is_existing', false,
            'message', 'Novo usuário criado com sucesso no auth.users.'
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
