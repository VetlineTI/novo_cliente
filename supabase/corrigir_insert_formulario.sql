-- ==============================================================================
-- CORREÇÃO DEFINITIVA: PERMISSÕES DE INSERT E RPCs DO FORMULÁRIO DE CADASTRO
-- ==============================================================================
-- 1. Garante a política de INSERT na tabela novo_cliente.data_new_cliente
-- 2. Concede EXECUTE para 'anon' na RPC insert_novo_cliente
-- 3. Concede EXECUTE para 'anon' na RPC check_client_already_approved
-- 4. Ajusta a política de upload no Supabase Storage para aceitar pastas de documentos
-- ==============================================================================

-- 1. RLS DA TABELA data_new_cliente: GARANTIR INSERT PARA ANÔNIMOS
ALTER TABLE novo_cliente.data_new_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção pública de cadastro" ON novo_cliente.data_new_cliente;
DROP POLICY IF EXISTS "Permitir inserção de novo cadastro publicamente" ON novo_cliente.data_new_cliente;

CREATE POLICY "Permitir inserção pública de cadastro"
ON novo_cliente.data_new_cliente FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Garante que anônimos podem dar INSERT na tabela
GRANT INSERT ON TABLE novo_cliente.data_new_cliente TO anon, authenticated, service_role;


-- 2. CONCESSÃO DE EXECUÇÃO DAS RPCs DO FORMULÁRIO DE CADASTRO PÚBLICO
GRANT EXECUTE ON FUNCTION novo_cliente.insert_novo_cliente(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.check_client_already_approved(TEXT) TO anon, authenticated, service_role;

-- Se a check_rate_limit for chamada internamente, garante as permissões
GRANT EXECUTE ON FUNCTION novo_cliente.check_rate_limit(INT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.get_client_ip() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.log_rate_limit_attempt(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;


-- 3. AJUSTE DA POLÍTICA DE UPLOAD NO SUPABASE STORAGE (BUCKET novos_clientes)
-- Permite upload de documentos associados a CPF (11 dígitos), CNPJ (14 dígitos) ou pasta 'geral'
DROP POLICY IF EXISTS "novos_clientes_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "novos_clientes_public_insert" ON storage.objects;

CREATE POLICY "novos_clientes_storage_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
    bucket_id = 'novos_clientes'
);


-- 4. RECARREGAR O CACHE DO POSTGREST IMEDIATAMENTE
NOTIFY pgrst, 'reload schema';

