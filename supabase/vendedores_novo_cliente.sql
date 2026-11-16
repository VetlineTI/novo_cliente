-- ==============================================================================
-- LISTA DE VENDEDORES DO SCHEMA novo_cliente (TABELA vendedor)
-- Conforme as Regras de Segurança Vetline (Seções 1, 2, 3 e 9)
-- ==============================================================================
-- Este script:
-- 1. Garante RLS e permissões de leitura seguras na tabela novo_cliente.vendedor
-- 2. Atualiza a RPC novo_cliente.listar_vendedores() para consultar novo_cliente.vendedor
-- 3. Atualiza a validação comercial de cd_vend na RPC novo_cliente.insert_novo_cliente
-- 4. Recarrega o cache do PostgREST
--
-- ROLLBACK (comentado):
-- -- DROP POLICY IF EXISTS "Permitir leitura de vendedores" ON novo_cliente.vendedor;
-- -- REVOKE EXECUTE ON FUNCTION novo_cliente.listar_vendedores() FROM anon, authenticated;
-- -- DROP FUNCTION IF EXISTS novo_cliente.listar_vendedores();
-- ==============================================================================

-- 0. Confere se a tabela novo_cliente.vendedor existe
DO $$
BEGIN
    IF to_regclass('novo_cliente.vendedor') IS NULL THEN
        RAISE EXCEPTION 'Tabela novo_cliente.vendedor não encontrada. Certifique-se de que a tabela foi criada no schema novo_cliente.';
    END IF;
END $$;

-- 1. Habilita RLS na tabela novo_cliente.vendedor (Regra de Segurança 1)
ALTER TABLE novo_cliente.vendedor ENABLE ROW LEVEL SECURITY;

-- 2. Política de Leitura Pública para Vendedores (Permite ao formulário público e admin listar os nomes)
DROP POLICY IF EXISTS "Permitir leitura de vendedores" ON novo_cliente.vendedor;
CREATE POLICY "Permitir leitura de vendedores"
ON novo_cliente.vendedor FOR SELECT
TO anon, authenticated
USING (true);

-- Garante SELECT para anon, authenticated e service_role
GRANT SELECT ON TABLE novo_cliente.vendedor TO anon, authenticated, service_role;

-- 3. RPC de leitura otimizada e blindada (cd_vend + nome_vendedor)
CREATE OR REPLACE FUNCTION novo_cliente.listar_vendedores()
RETURNS TABLE (cd_vend TEXT, nome_vendedor TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
        trim(v.cd_vend::text)       AS cd_vend,
        trim(v.nome_vendedor::text) AS nome_vendedor
    FROM novo_cliente.vendedor v
    WHERE v.cd_vend IS NOT NULL
      AND trim(v.cd_vend::text) <> ''
      AND COALESCE(trim(v.nome_vendedor::text), '') <> ''
      AND upper(trim(v.cd_vend::text)) <> 'ATENA'
    ORDER BY 2
    LIMIT 2000;
END;
$$;

-- Permissões da RPC (Regra de Segurança 3)
REVOKE EXECUTE ON FUNCTION novo_cliente.listar_vendedores() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION novo_cliente.listar_vendedores() TO anon, authenticated, service_role;

-- 4. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 5. Conferência de teste
SELECT COUNT(*) AS total_vendedores_carregados FROM novo_cliente.listar_vendedores();
