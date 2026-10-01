-- ==============================================================================
-- Migration: Adicionar coluna limite_credito no schema novo_cliente
-- ==============================================================================
-- Regra de Negócio:
-- - Pessoa Jurídica (PJ) sem protestos: Limite inicial de R$ 3.000,00
-- - Pessoa Física (PF) sem protestos: Limite inicial de R$ 1.500,00
-- - Clientes com protestos ativos: Limite inicial de R$ 0,00
-- ==============================================================================

-- 1. Adiciona coluna limite_credito na tabela principal novo_cliente.data_new_cliente
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(12,2) DEFAULT 0.00;

-- 2. Adiciona comentário explicativo na coluna
COMMENT ON COLUMN novo_cliente.data_new_cliente.limite_credito IS 'Limite de crédito concedido pela análise/regras (PJ R$ 3000, PF R$ 1500 sem protestos)';

-- 3. Atualiza cadastros existentes sem limite preenchido com base no histórico de protestos e tipo de pessoa
UPDATE novo_cliente.data_new_cliente
SET limite_credito = CASE 
    WHEN (total_protestos IS NULL OR total_protestos = 0) AND tipo_pessoa = 'PJ' THEN 3000.00
    WHEN (total_protestos IS NULL OR total_protestos = 0) AND tipo_pessoa = 'PF' THEN 1500.00
    ELSE 0.00
END
WHERE limite_credito IS NULL OR limite_credito = 0.00;

-- 4. Atualiza a view de compatibilidade novo_cliente.data_new_client (se existir como VIEW)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client'
    ) THEN
        CREATE OR REPLACE VIEW novo_cliente.data_new_client AS
        SELECT * FROM novo_cliente.data_new_cliente;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE novo_cliente.data_new_client 
        ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(12,2) DEFAULT 0.00;
    END IF;
END $$;
