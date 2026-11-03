-- ==============================================================================
-- DIAGNÓSTICO E CORREÇÃO DEFINITIVA DO PAINEL ADMIN
-- ==============================================================================
-- Este script verifica a existência de registros, confere o admin e libera o acesso
-- ==============================================================================

-- 1. CONSULTA DE REGISTROS EXISTENTES
SELECT 'novo_cliente.data_new_cliente' AS tabela, COUNT(*) AS total_registros FROM novo_cliente.data_new_cliente
UNION ALL
SELECT 'novo_cliente.admin_profiles' AS tabela, COUNT(*) AS total_registros FROM novo_cliente.admin_profiles
UNION ALL
SELECT 'auth.users' AS tabela, COUNT(*) AS total_registros FROM auth.users;

-- 2. VERIFICA SE TI02 ESTÁ COMO ADMIN
SELECT id, email, role, is_admin 
FROM novo_cliente.admin_profiles 
WHERE email = 'ti02@vetlinebrasil.com.br';

-- 3. SE NÃO TIVER REGISTROS EM DATA_NEW_CLIENTE, VERIFICA SE ESTÃO NA TABELA ANTIGA
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client') THEN
        RAISE NOTICE 'Tabela data_new_client existe';
    END IF;
END $$;

