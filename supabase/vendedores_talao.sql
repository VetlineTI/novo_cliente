-- ==============================================================================
-- LISTA DE VENDEDORES DO SCHEMA talao PARA O FORMULÁRIO PÚBLICO
-- Conforme as Regras de Segurança Vetline (Seções 1, 2, 3 e 9)
-- ==============================================================================
-- * A tabela talao.vendedor (cd_vend, nome_vendedor, nome_equipe, nome_gerencia)
--   pertence a outro sistema e NÃO recebe nenhum grant novo.
-- * O formulário (anon) acessa somente esta RPC, que devolve apenas
--   cd_vend + nome_vendedor dos vendedores ativos (sem equipe/gerência).
-- * Vendedores cuja equipe contém "INATIV" são ocultados.
--
-- ORDEM: rode este arquivo ANTES do corrigir_erros_console.sql
-- (a insert_novo_cliente passa a validar o cd_vend nesta mesma tabela).
--
-- ROLLBACK (comentado):
-- REVOKE EXECUTE ON FUNCTION novo_cliente.listar_vendedores() FROM anon, authenticated;
-- DROP FUNCTION IF EXISTS public.listar_vendedores();
-- DROP FUNCTION IF EXISTS novo_cliente.listar_vendedores();
-- ==============================================================================

-- 0. Confere se a tabela existe com o nome esperado
DO $$
BEGIN
    IF to_regclass('talao.vendedor') IS NULL THEN
        RAISE EXCEPTION 'Tabela talao.vendedor não encontrada. Ajuste o nome da tabela neste script.';
    END IF;
END $$;

-- 1. RPC de leitura mínima
CREATE OR REPLACE FUNCTION novo_cliente.listar_vendedores()
RETURNS TABLE (cd_vend TEXT, nome_vendedor TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
    SELECT
        trim(v.cd_vend::text)       AS cd_vend,
        trim(v.nome_vendedor::text) AS nome_vendedor
    FROM talao.vendedor v
    WHERE v.cd_vend IS NOT NULL
      AND trim(v.cd_vend::text) <> ''
      AND COALESCE(trim(v.nome_vendedor::text), '') <> ''
      AND COALESCE(v.nome_equipe::text, '') NOT ILIKE '%INATIV%'
      AND upper(trim(v.cd_vend::text)) <> 'ATENA'
    ORDER BY 2
    LIMIT 2000;
$$;

-- Wrapper no public (o client do Supabase chama o schema public por padrão)
CREATE OR REPLACE FUNCTION public.listar_vendedores()
RETURNS TABLE (cd_vend TEXT, nome_vendedor TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = novo_cliente, pg_temp
AS $$
    SELECT * FROM novo_cliente.listar_vendedores();
$$;

REVOKE EXECUTE ON FUNCTION novo_cliente.listar_vendedores() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.listar_vendedores() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION novo_cliente.listar_vendedores() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_vendedores() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT COUNT(*) AS vendedores_ativos_listados FROM novo_cliente.listar_vendedores();

