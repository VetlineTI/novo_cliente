-- ==============================================================================
-- DIAGNÓSTICO E LIBERAÇÃO IMEDIATA DO PAINEL ADMIN
-- Execute este script no SQL Editor do Supabase
-- ==============================================================================

-- 1. GARANTE QUE O ADMIN TI02 ESTÁ ATIVO COM PAPEL 'admin'
INSERT INTO novo_cliente.admin_profiles (id, email, full_name, role, is_admin, created_at, updated_at)
SELECT 
    id, 
    email, 
    'Administrador TI', 
    'admin', 
    true, 
    now(), 
    now()
FROM auth.users
WHERE email = 'ti02@vetlinebrasil.com.br'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_admin = true,
    updated_at = now();


-- 2. GARANTE POLÍTICA DE LEITURA TOTAL PARA USUÁRIOS AUTENTICADOS NO ADMIN
-- Permite que a equipe autenticada veja todos os clientes sem bloqueios
DROP POLICY IF EXISTS "Permitir leitura restrita de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura de clientes" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir leitura apenas para equipe autenticada" ON novo_cliente.data_new_cliente;

CREATE POLICY "Permitir leitura de clientes para equipe autenticada"
ON novo_cliente.data_new_cliente FOR SELECT
TO authenticated
USING (true);


-- 3. GARANTE A VIEW DE COMPATIBILIDADE DATA_NEW_CLIENT COM SECURITY INVOKER
CREATE OR REPLACE VIEW novo_cliente.data_new_client 
WITH (security_invoker = on) AS 
SELECT * FROM novo_cliente.data_new_cliente;

GRANT SELECT ON novo_cliente.data_new_client TO authenticated, service_role;
GRANT SELECT ON novo_cliente.data_new_cliente TO authenticated, service_role;


-- 4. VERIFICAÇÃO DE REGISTROS (O RESULTADO APARECERÁ NA ABA RESULTS DO SUPABASE)
SELECT 
    'Cadastros em data_new_cliente' AS item, 
    COUNT(*)::text AS total 
FROM novo_cliente.data_new_cliente
UNION ALL
SELECT 
    'Perfil do ti02@vetlinebrasil.com.br', 
    COALESCE((SELECT role || ' (is_admin: ' || is_admin::text || ')' FROM novo_cliente.admin_profiles WHERE email = 'ti02@vetlinebrasil.com.br'), 'NÃO ENCONTRADO')
UNION ALL
SELECT 
    'Último cliente cadastrado (CPF/CNPJ)', 
    COALESCE((SELECT cpf_cnpj || ' - ' || razao_social_nome FROM novo_cliente.data_new_cliente ORDER BY criado_em DESC LIMIT 1), 'Nenhum cadastrado ainda');

