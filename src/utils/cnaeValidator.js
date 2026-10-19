/**
 * Validação e catálogo de CNAEs permitidos para cadastro na Vetline
 * Lista homologada de atividades econômicas principais
 */

export const PERMITTED_CNAES = [
  { code: '4789-0/04', clean: '4789004', description: 'Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação' },
  { code: '4771-7/04', clean: '4771704', description: 'Comércio varejista de medicamentos veterinários' },
  { code: '9609-2/08', clean: '9609208', description: 'Higiene e embelezamento de animais domésticos' },
  { code: '7500-1/00', clean: '7500100', description: 'Atividades veterinárias' },
  { code: '4623-1/01', clean: '4623101', description: 'Comércio atacadista de animais vivos' },
  { code: '4623-1/09', clean: '4623109', description: 'Comércio atacadista de matérias-primas agrícolas não especificadas anteriormente' },
  { code: '4632-0/01', clean: '4632001', description: 'Comércio atacadista de cereais e leguminosas beneficiados' },
  { code: '4646-0/02', clean: '4646002', description: 'Comércio atacadista de produtos de higiene, limpeza e conservação domiciliar' },
  { code: '4646-0/01', clean: '4646001', description: 'Comércio atacadista de cosméticos e produtos de perfumaria' },
  { code: '4644-3/02', clean: '4644302', description: 'Comércio atacadista de medicamentos e drogas de uso veterinário' },
  { code: '4669-9/99', clean: '4669999', description: 'Comércio atacadista de outras máquinas e equipamentos não especificados anteriormente' },
  { code: '4712-1/00', clean: '4712100', description: 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios' },
  { code: '4789-0/02', clean: '4789002', description: 'Comércio varejista de plantas e flores naturais' },
  { code: '0151-2/01', clean: '0151201', description: 'Criação de bovinos para reprodução' },
  { code: '0153-9/01', clean: '0153901', description: 'Criação de suínos' },
  { code: '0155-5/01', clean: '0155501', description: 'Criação de frangos para corte' },
  { code: '0155-5/02', clean: '0155502', description: 'Produção de ovos' },
  { code: '1099-6/99', clean: '1099699', description: 'Fabricação de outros produtos alimentícios não especificados anteriormente' },
  { code: '2123-8/00', clean: '2123800', description: 'Fabricação de preparações farmacêuticas' },
  { code: '4930-2/02', clean: '4930202', description: 'Transporte rodoviário de produtos em geral, municipal' },
  { code: '8411-6/00', clean: '8411600', description: 'Administração pública em geral' },
  { code: '9430-8/00', clean: '9430800', description: 'Atividades de associações de defesa de direitos sociais' },
  { code: '8599-6/99', clean: '8599699', description: 'Outras atividades de ensino não especificadas anteriormente' },
  { code: '8640-2/02', clean: '8640202', description: 'Laboratórios clínicos' }
];

/**
 * Formata um código de CNAE com 7 dígitos no formato oficial (Ex: 4789-0/04)
 * @param {string|number} rawCode 
 * @returns {string}
 */
export const formatCnaeCode = (rawCode) => {
  if (!rawCode) return '';
  const digits = String(rawCode).replace(/\D/g, '');
  if (digits.length === 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5, 7)}`;
  }
  return String(rawCode).trim();
};

/**
 * Decompõe e extrai código e descrição de qualquer formato de CNAE
 * Ex: "4789-0/04 - Comércio varejista..." ou "4789004" ou "Comércio varejista..."
 * @param {string|number|Object} input 
 * @returns {{ code: string, cleanCode: string, description: string, formatted: string }}
 */
export const parseCnae = (input) => {
  if (!input) {
    return { code: '', cleanCode: '', description: '', formatted: '' };
  }

  if (typeof input === 'object') {
    const rawCode = input.codigo || input.cnaeCodigo || input.code || input.cnae_fiscal || '';
    const rawDesc = input.descricao || input.cnaeDescricao || input.description || input.cnae_fiscal_descricao || '';
    const clean = String(rawCode).replace(/\D/g, '');
    const code = formatCnaeCode(rawCode);
    const desc = String(rawDesc).trim();
    const formatted = code && desc ? `${code} - ${desc}` : (code || desc);
    return { code, cleanCode: clean, description: desc, formatted };
  }

  const str = String(input).trim();
  // Se contiver hífen e barra no padrão de CNAE (ex: 4789-0/04 - Descrição)
  const regexCnae = /^(\d{4}[-/]?\d[-/]?\d{2})\s*[-–:]?\s*(.*)$/;
  const match = str.match(regexCnae);

  if (match) {
    const rawCode = match[1];
    const desc = match[2]?.trim() || '';
    const clean = rawCode.replace(/\D/g, '');
    const code = formatCnaeCode(rawCode);
    const formatted = code && desc ? `${code} - ${desc}` : (code || desc);
    return { code, cleanCode: clean, description: desc, formatted };
  }

  // Se forem apenas dígitos de CNAE (ex: 4789004)
  const cleanDigits = str.replace(/\D/g, '');
  if (cleanDigits.length === 7) {
    const code = formatCnaeCode(cleanDigits);
    const matchedPerm = PERMITTED_CNAES.find(p => p.clean === cleanDigits);
    const desc = matchedPerm ? matchedPerm.description : '';
    const formatted = desc ? `${code} - ${desc}` : code;
    return { code, cleanCode: cleanDigits, description: desc, formatted };
  }

  // Texto descritivo puro
  return { code: '', cleanCode: '', description: str, formatted: str };
};

/**
 * Valida se um CNAE (código ou descrição) consta na lista de CNAEs permitidos
 * @param {string|number|Object} cnaeCodeOrInput Código ou objeto de CNAE
 * @param {string} [cnaeDesc] Descrição opcional
 * @returns {{
 *   isPermitted: boolean,
 *   hasCnae: boolean,
 *   cnaeCode: string,
 *   cleanCode: string,
 *   cnaeDescription: string,
 *   formattedCnae: string,
 *   matchedPermitted: Object|null
 * }}
 */
export const checkCnaePermitted = (cnaeCodeOrInput, cnaeDesc = '') => {
  if (!cnaeCodeOrInput && !cnaeDesc) {
    return {
      isPermitted: true, // Sem CNAE (ex: PF) não gera alerta de CNAE não permitido
      hasCnae: false,
      cnaeCode: '',
      cleanCode: '',
      cnaeDescription: '',
      formattedCnae: '',
      matchedPermitted: null
    };
  }

  const parsed = parseCnae(cnaeCodeOrInput);
  const finalDesc = (parsed.description || cnaeDesc || '').trim();
  const finalClean = parsed.cleanCode || String(cnaeCodeOrInput).replace(/\D/g, '');
  const finalCode = parsed.code || formatCnaeCode(finalClean);
  const formattedCnae = parsed.formatted || (finalCode && finalDesc ? `${finalCode} - ${finalDesc}` : (finalCode || finalDesc));

  // 1. Tenta bater pelo código limpo (7 dígitos)
  if (finalClean && finalClean.length >= 7) {
    const matched = PERMITTED_CNAES.find(p => p.clean === finalClean || finalClean.startsWith(p.clean));
    if (matched) {
      return {
        isPermitted: true,
        hasCnae: true,
        cnaeCode: matched.code,
        cleanCode: matched.clean,
        cnaeDescription: finalDesc || matched.description,
        formattedCnae: `${matched.code} - ${finalDesc || matched.description}`,
        matchedPermitted: matched
      };
    }
  }

  // 2. Tenta bater por código exato formatado
  if (finalCode) {
    const matched = PERMITTED_CNAES.find(p => p.code === finalCode);
    if (matched) {
      return {
        isPermitted: true,
        hasCnae: true,
        cnaeCode: matched.code,
        cleanCode: matched.clean,
        cnaeDescription: finalDesc || matched.description,
        formattedCnae: `${matched.code} - ${finalDesc || matched.description}`,
        matchedPermitted: matched
      };
    }
  }

  // 3. Fallback: Tenta bater pela descrição se não houver código ou código for ambíguo
  if (finalDesc) {
    const lowerDesc = finalDesc.toLowerCase();
    const matched = PERMITTED_CNAES.find(p => {
      const pDesc = p.description.toLowerCase();
      return pDesc === lowerDesc || lowerDesc.includes(pDesc) || pDesc.includes(lowerDesc);
    });
    if (matched) {
      return {
        isPermitted: true,
        hasCnae: true,
        cnaeCode: finalCode || matched.code,
        cleanCode: finalClean || matched.clean,
        cnaeDescription: finalDesc,
        formattedCnae: `${matched.code} - ${finalDesc}`,
        matchedPermitted: matched
      };
    }
  }

  // Se tem código ou descrição e não bateu com nenhum dos 24 homologados:
  return {
    isPermitted: false,
    hasCnae: true,
    cnaeCode: finalCode,
    cleanCode: finalClean,
    cnaeDescription: finalDesc,
    formattedCnae: formattedCnae || 'CNAE não especificado',
    matchedPermitted: null
  };
};
