import { checkCompanyAge } from './validators';

/**
 * Calcula a Condição de Pagamento e Prazo Médio (ERP Moinho) com base nas regras:
 * 1. Com Protesto (CPF ou CNPJ): condicao = 6, praz_medio = 28
 * 2. CPF Sem Protesto: condicao = 49, praz_medio = 28
 * 3. CNPJ Sem Protesto até 6 meses de abertura: condicao = 6, praz_medio = 14
 * 4. CNPJ Sem Protesto com mais de 6 meses: condicao = 49, praz_medio = 28
 * 
 * @param {Object} params
 * @param {'PF'|'PJ'} params.tipo_pessoa
 * @param {string|Date|null} [params.data_abertura]
 * @param {number|null} [params.total_protestos]
 * @returns {{ condicao_pagamento: number, praz_medio: number, motivo: string }}
 */
export const calcularCondicaoEPrazoPagamento = ({ tipo_pessoa, data_abertura, total_protestos }) => {
  const isPJ = String(tipo_pessoa || '').toUpperCase() === 'PJ';
  const hasProtest = total_protestos !== null && total_protestos !== undefined && Number(total_protestos) > 0;

  // 1. Caso com Protesto (CPF ou CNPJ)
  if (hasProtest) {
    return {
      condicao_pagamento: 6,
      praz_medio: 28,
      motivo: `Possui ${total_protestos} protesto(s) ativo(s): Condição 6 / Prazo 28 dias`
    };
  }

  // 2. Pessoa Física (CPF) sem protesto
  if (!isPJ) {
    return {
      condicao_pagamento: 49,
      praz_medio: 28,
      motivo: 'Pessoa Física (CPF) sem protestos: Condição 49 / Prazo 28 dias'
    };
  }

  // 3. Pessoa Jurídica (CNPJ) sem protesto
  const ageInfo = checkCompanyAge(data_abertura);
  const isRecent6Months = ageInfo.hasDate && ageInfo.diffDays !== null && ageInfo.diffDays <= 180;

  if (isRecent6Months) {
    return {
      condicao_pagamento: 6,
      praz_medio: 14,
      motivo: `CNPJ recente (${ageInfo.ageText || 'até 6 meses'}) sem protestos: Condição 6 / Prazo 14 dias`
    };
  }

  // 4. CNPJ com mais de 6 meses sem protesto
  return {
    condicao_pagamento: 49,
    praz_medio: 28,
    motivo: `CNPJ com mais de 6 meses (${ageInfo.ageText || 'consolidado'}) sem protestos: Condição 49 / Prazo 28 dias`
  };
};
