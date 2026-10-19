-- ==============================================================================
-- Migration: Adicionar colunas de CNAE no schema novo_cliente
-- ==============================================================================
-- Armazena o código e a descrição da atividade econômica principal (CNAE)
-- extraída via API da Receita Federal para validação de CNAEs permitidos.
-- ==============================================================================

-- 1. Adiciona as colunas na tabela principal novo_cliente.data_new_cliente
ALTER TABLE novo_cliente.data_new_cliente 
ADD COLUMN IF NOT EXISTS cnae TEXT,
ADD COLUMN IF NOT EXISTS cnae_codigo VARCHAR(20),
ADD COLUMN IF NOT EXISTS cnae_descricao TEXT;

-- 2. Adiciona comentários explicativos
COMMENT ON COLUMN novo_cliente.data_new_cliente.cnae IS 'Código e descrição completa do CNAE principal (ex: 4789-0/04 - Comércio varejista de animais vivos...)';
COMMENT ON COLUMN novo_cliente.data_new_cliente.cnae_codigo IS 'Código formatado do CNAE (ex: 4789-0/04)';
COMMENT ON COLUMN novo_cliente.data_new_cliente.cnae_descricao IS 'Descrição oficial da atividade econômica na Receita Federal';

-- 3. Atualiza a view de compatibilidade novo_cliente.data_new_client
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
        ADD COLUMN IF NOT EXISTS cnae TEXT,
        ADD COLUMN IF NOT EXISTS cnae_codigo VARCHAR(20),
        ADD COLUMN IF NOT EXISTS cnae_descricao TEXT;
    END IF;
END $$;
