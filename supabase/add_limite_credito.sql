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
COMMENT ON COLUMN novo_cliente.data_new_cliente.limite_credito IS 'Limite de crédito pré-aprovado ou concedido pela análise (Padrão: PJ R$ 3000, PF R$ 1500 sem protestos)';

-- 3. Atualiza cadastros existentes sem limite preenchido com base no histórico
UPDATE novo_cliente.data_new_cliente
SET limite_credito = CASE 
    WHEN (total_protestos IS NULL OR total_protestos = 0) AND tipo_pessoa = 'PJ' THEN 3000.00
    WHEN (total_protestos IS NULL OR total_protestos = 0) AND tipo_pessoa = 'PF' THEN 1500.00
    ELSE 0.00
END
WHERE limite_credito IS NULL OR limite_credito = 0;

-- 4. Garante coluna em data_new_client caso a tabela legada ainda exista
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'novo_cliente' AND table_name = 'data_new_client'
    ) THEN
        ALTER TABLE novo_cliente.data_new_client 
        ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(12,2) DEFAULT 0.00;
    END IF;
END $$;
