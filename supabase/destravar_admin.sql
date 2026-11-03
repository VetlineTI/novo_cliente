-- ==============================================================================
-- DESTRAVAR LISTAGEM DO ADMIN (VERSÃO SEGURA)
-- ==============================================================================
-- ATENÇÃO: a versão anterior deste arquivo concedia EXECUTE/SELECT para anon,
-- o que expunha todos os cadastros sem login. Corrigido: só authenticated, e as
-- funções administrativas checam is_admin() internamente.
-- Para fechar de vez, rode também: supabase/revogar_funcoes_admin_anon.sql
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION novo_cliente.get_novo_cliente_clients(TEXT, TEXT) TO authenticated, service_role;

REVOKE SELECT ON TABLE novo_cliente.data_new_cliente FROM anon;
GRANT SELECT ON TABLE novo_cliente.data_new_cliente TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT COUNT(*) AS total_clientes_no_banco FROM novo_cliente.data_new_cliente;
