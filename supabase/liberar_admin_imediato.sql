-- ==============================================================================
-- DESATIVADO - NÃO EXECUTAR
-- ==============================================================================
-- A versão anterior deste script criava uma política SELECT USING (true) para
-- authenticated em novo_cliente.data_new_cliente, permitindo que QUALQUER conta
-- logada (de qualquer sistema do projeto) lesse todos os cadastros.
-- Use no lugar: supabase/revogar_funcoes_admin_anon.sql
-- ==============================================================================
SELECT 'Script desativado. Use supabase/revogar_funcoes_admin_anon.sql' AS aviso;
