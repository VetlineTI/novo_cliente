/**
 * Validador e resolvedor oficial de Tipo de Inscrição (tp_inscr / tp_inscricao) e Inscrição para o ERP Moinho.
 * 
 * Regras do ERP Moinho:
 * - O código 'N' NÃO EXISTE no Moinho. Valores aceitos: 'E' (Estadual), 'I' (Isento), 'M' (Municipal).
 * - PJ com IE numérica -> 'E', com inscrição só em dígitos.
 * - PJ isento ou sem IE -> 'I'.
 * - PF -> 'I'.
 * - PF com IE numérica -> 'E', com inscrição só em dígitos.
 * - Inscrição Municipal -> 'M', com inscrição só em dígitos.
 * 
 * @param {Object} params
 * @param {'PF'|'PJ'|string} [params.tipo_pessoa]
 * @param {'E'|'I'|'M'|string} [params.tp_inscricao]
 * @param {string|number|null} [params.numero_inscricao]
 * @param {string|number|null} [params.numero_ie]
 * @returns {{
 *   tp_inscr: 'E'|'I'|'M',
 *   tp_inscricao: 'E'|'I'|'M',
 *   inscricao: string,
 *   numero_inscricao: string,
 *   possui_ie: boolean,
 *   is_isento: boolean
 * }}
 */
export const resolverTipoENumeroInscricao = ({ tipo_pessoa, tp_inscricao, numero_inscricao, numero_ie }) => {
  const isPJ = String(tipo_pessoa || '').toUpperCase() === 'PJ';
  const rawNum = String(numero_inscricao ?? numero_ie ?? '').trim();
  const rawTp = String(tp_inscricao || '').trim().toUpperCase();

  // Limpa caracteres especiais, deixando apenas números
  const onlyDigits = rawNum.replace(/\D/g, '');
  const hasNumericDigits = onlyDigits.length > 0;
  const isExplicitlyIsento = rawNum.toUpperCase() === 'ISENTO' || rawTp === 'I';

  // 1. Caso Inscrição Municipal ('M')
  if (rawTp === 'M') {
    return {
      tp_inscr: 'M',
      tp_inscricao: 'M',
      inscricao: hasNumericDigits ? onlyDigits : (rawNum || 'ISENTO'),
      numero_inscricao: hasNumericDigits ? onlyDigits : (rawNum || 'ISENTO'),
      possui_ie: false,
      is_isento: false
    };
  }

  // 2. Se possuir IE puramente numérica (seja PJ ou PF com IE) e não for explicitamente isento
  if (hasNumericDigits && !isExplicitlyIsento) {
    return {
      tp_inscr: 'E',
      tp_inscricao: 'E',
      inscricao: onlyDigits, // Apenas dígitos no ERP Moinho
      numero_inscricao: onlyDigits,
      possui_ie: true,
      is_isento: false
    };
  }

  // 3. Caso Isento ou Sem IE (PJ isento/sem IE ou PF sem IE)
  return {
    tp_inscr: 'I',
    tp_inscricao: 'I',
    inscricao: 'ISENTO',
    numero_inscricao: 'ISENTO',
    possui_ie: false,
    is_isento: true
  };
};
