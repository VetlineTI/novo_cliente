-- ==============================================================================
-- MIGRATION: AJUSTE DE REGRAS DE tp_inscr E numero_inscricao PARA O ERP MOINHO
-- ==============================================================================
-- Regras do ERP Moinho:
-- - O código 'N' NÃO EXISTE no Moinho. Apenas 'E' (Estadual), 'I' (Isento) e 'M' (Municipal).
-- - PJ com IE numérica -> 'E', com inscrição só em dígitos.
-- - PJ isento ou sem IE -> 'I'.
-- - PF -> 'I'.
-- - PF com IE numérica -> 'E', com inscrição só em dígitos.
-- ==============================================================================

-- 1. CORREÇÃO RETROATIVA DOS REGISTROS EXISTENTES
-- A) Se possuir IE numérica (dígitos): força 'E' e limpa para deixar apenas dígitos
UPDATE novo_cliente.data_new_cliente
SET 
    tp_inscricao = 'E',
    numero_inscricao = regexp_replace(numero_inscricao, '\D', '', 'g')
WHERE 
    numero_inscricao IS NOT NULL 
    AND numero_inscricao ~ '\d' 
    AND numero_inscricao !~* 'isento';

-- B) Se for isento, sem IE numérica ou com código 'N': força 'I' e 'ISENTO'
UPDATE novo_cliente.data_new_cliente
SET 
    tp_inscricao = 'I',
    numero_inscricao = 'ISENTO'
WHERE 
    tp_inscricao = 'N' 
    OR tp_inscricao IS NULL 
    OR numero_inscricao IS NULL 
    OR numero_inscricao ~* 'isento' 
    OR numero_inscricao !~ '\d';

-- 2. REFORÇA A CONSTRAINT PARA GARANTIR APENAS 'E', 'I' OU 'M'
ALTER TABLE novo_cliente.data_new_cliente
DROP CONSTRAINT IF EXISTS check_tp_inscricao;

ALTER TABLE novo_cliente.data_new_cliente
ADD CONSTRAINT check_tp_inscricao 
CHECK (tp_inscricao IN ('E', 'I', 'M'));

-- 3. COMENTÁRIOS EXPLICATIVOS
COMMENT ON COLUMN novo_cliente.data_new_cliente.tp_inscricao IS 'Tipo de Inscrição ERP Moinho: E (Estadual), I (Isento), M (Municipal). O código N não existe no ERP.';
COMMENT ON COLUMN novo_cliente.data_new_cliente.numero_inscricao IS 'Número da Inscrição (apenas dígitos numéricos quando E/M; ISENTO quando I)';

-- 4. RECARREGA O CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- ROLLBACK (comentado conforme Regras de Segurança Vetline - Seção 8):
-- ==============================================================================
-- ALTER TABLE novo_cliente.data_new_cliente DROP CONSTRAINT IF EXISTS check_tp_inscricao;
-- NOTIFY pgrst, 'reload schema';
