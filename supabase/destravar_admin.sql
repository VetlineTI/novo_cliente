-- ==============================================================================
-- DESTRAVAR DEFINITIVO DA LISTAGEM DO ADMIN E CONTAGEM
-- ==============================================================================

-- 1. Elimina de vez o erro 42501 concedendo EXECUTE para as funções de listagem
GRANT EXECUTE ON FUNCTION public.get_novo_cliente_clients(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. Garante SELECT na tabela de clientes
GRANT SELECT ON TABLE novo_cliente.data_new_cliente TO anon, authenticated, service_role;

-- 3. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 4. VERIFICAÇÃO DIRETA: Quantos clientes existem realmente no banco agora?
SELECT 
    COUNT(*) AS total_clientes_no_banco,
    CASE 
        WHEN COUNT(*) = 0 THEN 'A tabela está VAZIA. Nenhum cliente foi salvo ainda porque o cadastro anterior foi barrado antes de gravar.'
        ELSE 'Existem cadastros no banco! Recarregue a página /admin.'
    END AS status_explicativo
FROM novo_cliente.data_new_cliente;
