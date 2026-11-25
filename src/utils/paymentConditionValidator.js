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
