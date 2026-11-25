import { checkCompanyAge } from './validators';

/**
 * Calcula a Condição de Pagamento e Prazo Médio (ERP Moinho) com base nas regras Vetline:
 * - CNPJ com até 6 meses de abertura (sem protesto): condição = 6, praz_medio = 14
 * - CNPJ com mais de 6 meses de abertura (consolidado, mesmo com protesto): condição = 49, praz_medio = 28
 * - CPF: condição = 49, praz_medio = 28
 * 
 * @param {Object} params
 * @param {'PF'|'PJ'} params.tipo_pessoa
 * @param {string|Date|null} [params.data_abertura]
 * @param {number|null} [params.total_protestos]
 * @returns {{ condicao_pagamento: number, praz_medio: number, motivo: string }}
 */
export const calcularCondicaoEPrazoPagamento = ({ tipo_pessoa, data_abertura, total_protestos }) => {
  const isPJ = String(tipo_pessoa || '').toUpperCase() === 'PJ';

  // 1. Pessoa Física (CPF): sempre condição 49 e prazo 28
  if (!isPJ) {
    return {
      condicao_pagamento: 49,
      praz_medio: 28,
      motivo: 'Pessoa Física (CPF): Condição 49 / Prazo 28 dias'
    };
  }

  // 2. Pessoa Jurídica (CNPJ)
  const ageInfo = checkCompanyAge(data_abertura);
  const isRecent6Months = ageInfo.hasDate && ageInfo.diffDays !== null && ageInfo.diffDays <= 180;

  // CNPJ recente até 6 meses de abertura: condição 6 e prazo 14
  if (isRecent6Months) {
    return {
      condicao_pagamento: 6,
      praz_medio: 14,
      motivo: `CNPJ recente (${ageInfo.ageText || 'até 6 meses de abertura'}): Condição 6 / Prazo 14 dias`
    };
  }

  // CNPJ com mais de 6 meses de abertura (ex: 7 meses): condição 49 e prazo 28
  return {
    condicao_pagamento: 49,
    praz_medio: 28,
    motivo: `CNPJ com mais de 6 meses (${ageInfo.ageText || 'consolidado'}): Condição 49 / Prazo 28 dias`
  };
};

/**
 * Calcula o Limite de Crédito oficial (Vetline) com base nas regras:
 * - Se tem protesto (> 0) (seja CPF ou CNPJ): limite = 500
 * - Se for CPF sem protesto: limite = 1500
 * - Se for CNPJ sem protesto:
 *     - Até 6 meses de abertura: limite = 1500
 *     - Mais de 6 meses de abertura: limite = 3000
 * 
 * @param {Object} params
 * @param {'PF'|'PJ'} params.tipo_pessoa
 * @param {string|Date|null} [params.data_abertura]
 * @param {number|null} [params.total_protestos]
 * @returns {{ limite_credito: number, motivo: string }}
 */
export const calcularLimiteCredito = ({ tipo_pessoa, data_abertura, total_protestos }) => {
  const isPJ = String(tipo_pessoa || '').toUpperCase() === 'PJ';
  const numProt = total_protestos !== null && total_protestos !== undefined ? Number(total_protestos) : 0;
  const hasProtesto = numProt > 0;

  // 1. Se tem protesto (CPF ou CNPJ): limite = 500
  if (hasProtesto) {
    return {
      limite_credito: 500.00,
      motivo: `Com protesto (${numProt} protesto(s)): limite de R$ 500,00`
    };
  }

  // 2. Pessoa Física (CPF) sem protesto: limite = 1500
  if (!isPJ) {
    return {
      limite_credito: 1500.00,
      motivo: 'Pessoa Física (CPF) sem protesto: limite de R$ 1.500,00'
    };
  }

  // 3. Pessoa Jurídica (CNPJ) sem protesto
  const ageInfo = checkCompanyAge(data_abertura);
  const isRecent6Months = ageInfo.hasDate && ageInfo.diffDays !== null && ageInfo.diffDays <= 180;

  // CNPJ sem protesto até 6 meses de abertura: limite = 1500
  if (isRecent6Months) {
    return {
      limite_credito: 1500.00,
      motivo: `CNPJ recente (${ageInfo.ageText || 'até 6 meses'}) sem protesto: limite de R$ 1.500,00`
    };
  }

  // CNPJ sem protesto e mais de 6 meses de abertura: limite = 3000
  return {
    limite_credito: 3000.00,
    motivo: `CNPJ consolidado (${ageInfo.ageText || 'mais de 6 meses'}) sem protesto: limite de R$ 3.000,00`
  };
};
