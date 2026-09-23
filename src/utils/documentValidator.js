import { unmask, maskCNPJ, maskCPF } from './masks';
import { isValidCNPJ, fetchCNPJDataFromBrasilAPI } from './validators';

// Keywords de documentos oficiais brasileiros
const DOC_KEYWORDS = {
  IDENTIFICATION: [
    'republica', 'república', 'federativa', 'brasil', 'carteira', 'nacional', 
    'habilitacao', 'habilitação', 'identidade', 'registro geral', 'rg', 'ssp',
    'secretaria', 'seguranca', 'segurança', 'detran', 'validade', 'filiacao', 
    'filiação', 'nascimento', 'doc', 'identificacao', 'identificação', 'crmv',
    'conselho', 'medicina', 'veterinaria', 'veterinária', 'cpf', 'motorista',
    'condutor', 'senatran', 'denatran', 'ministerio', 'ministério'
  ],
  CONTRACT: [
    'contrato', 'social', 'constitutivo', 'junta', 'comercial', 'clausula', 
    'cláusula', 'socios', 'sócios', 'quotas', 'capital', 'empresa', 'cnpj',
    'estatuto', 'requerimento', 'empresario', 'empresário', 'denominacao',
    'denominação', 'sede', 'administracao', 'administração'
  ],
  ADDRESS: [
    'endereco', 'endereço', 'comprovante', 'energia', 'agua', 'água', 'luz',
    'fatura', 'conta', 'vencimento', 'consumo', 'cep', 'rua', 'avenida', 
    'bairro', 'municipio', 'município', 'instalacao', 'instalação', 'cliente',
    'telefone', 'gas', 'gás', 'enel', 'cpfl', 'sabesp', 'sanepar', 'copel', 'cemig'
  ],
  IE: [
    'inscricao', 'inscrição', 'estadual', 'sintegra', 'sefaz', 'fazenda',
    'secretaria', 'comprovante', 'contribuinte', 'situacao', 'situação',
    'cadastral', 'ativa', 'cce', 'icms'
  ]
};

/**
 * Carrega dinamicamente as bibliotecas pesadas apenas quando o usuário anexa um arquivo
 */
async function loadLibraries() {
  const [tesseractModule, jsqrModule, pdfjsModule] = await Promise.all([
    import('tesseract.js'),
    import('jsqr'),
    import('pdfjs-dist/legacy/build/pdf.mjs')
  ]);

  // Configura worker do PDF.js
  if (pdfjsModule.GlobalWorkerOptions) {
    pdfjsModule.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsModule.version || '4.0.379'}/pdf.worker.min.mjs`;
  }

  return {
    Tesseract: tesseractModule.default || tesseractModule,
    jsQR: jsqrModule.default || jsqrModule,
    pdfjs: pdfjsModule
  };
}

/**
 * Escaneia QR Code de uma imagem usando Canvas e jsQR
 */
function scanQRCodeFromCanvas(canvas, jsQR) {
  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });
    return code ? code.data : null;
  } catch (err) {
    return null;
  }
}

/**
 * Converte um arquivo de imagem para HTMLCanvasElement
 */
function imageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Extrai texto e renderiza a primeira página de um PDF em Canvas
 */
async function processPDF(file, pdfjs, jsQR) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // 1. Extração de texto direto do PDF digital
  const textContent = await page.getTextContent();
  let directText = textContent.items.map((item) => item.str).join(' ');

  // 2. Renderização da página em Canvas para leitura de QR Code e OCR de suporte
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  
  await page.render({ canvasContext: ctx, viewport }).promise;

  let qrData = null;
  if (jsQR) {
    qrData = scanQRCodeFromCanvas(canvas, jsQR);
  }

  return { directText, canvas, qrData };
}

/**
 * Função Principal de Validação de Documento Anexado
 * @param {File} file Arquivo de imagem ou PDF
 * @param {Object} options Dados esperados para cruzamento
 * @returns {Promise<Object>} Resultado estruturado da validação
 */
export async function validateDocumentAttachment(file, { expectedDocument = '', expectedName = '', category = 'IDENTIFICATION', expectedPartners = [] } = {}) {
  if (!file) {
    return { isValid: false, status: 'EMPTY', message: 'Nenhum arquivo informado.' };
  }

  const cleanExpectedDoc = unmask(expectedDocument);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(file.name);

  if (!isPdf && !isImage) {
    return {
      isValid: false,
      status: 'INVALID_FORMAT',
      message: 'Formato não suportado. Por favor, anexe PDF, JPG ou PNG.'
    };
  }

  try {
    const { Tesseract, jsQR, pdfjs } = await loadLibraries();

    let extractedText = '';
    let qrData = null;
    let canvasForOCR = null;

    if (isPdf) {
      const pdfResult = await processPDF(file, pdfjs, jsQR);
      extractedText = pdfResult.directText || '';
      qrData = pdfResult.qrData;
      canvasForOCR = pdfResult.canvas;
    } else {
      const imgResult = await imageToCanvas(file);
      canvasForOCR = imgResult.canvas;
      if (jsQR) {
        qrData = scanQRCodeFromCanvas(canvasForOCR, jsQR);
      }
    }

    // Se o texto direto for curto (ex: PDF escaneado ou foto pura), roda o OCR Tesseract
    if (extractedText.length < 50 && canvasForOCR) {
      const ocrResult = await Tesseract.recognize(canvasForOCR, 'por', {
        logger: () => {} // silencioso
      });
      extractedText += ' ' + (ocrResult?.data?.text || '');
    }

    const fullRawText = `${extractedText} ${qrData || ''}`;
    const normalizedText = fullRawText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // remove acentos para busca precisa

    // =========================================================================
    // 1. CHECAGEM DE CNPJ DIVERGENTE NO ARQUIVO
    // =========================================================================
    if (cleanExpectedDoc && cleanExpectedDoc.length === 14) {
      const foundCnpjs = extractCnpjsFromText(fullRawText);
      if (foundCnpjs.length > 0 && !foundCnpjs.includes(cleanExpectedDoc)) {
        const divergentCnpj = foundCnpjs[0];
        return {
          isValid: false,
          isWarning: true,
          status: 'CNPJ_MISMATCH',
          badge: 'CNPJ Divergente Detectado',
          message: `O documento contém o CNPJ ${maskCNPJ(divergentCnpj)}, diferente do CNPJ cadastrado (${maskCNPJ(cleanExpectedDoc)}).`,
          details: 'Por favor, anexe o documento pertencente ao mesmo CNPJ preenchido no cadastro.',
          score: 10,
          qrFound: Boolean(qrData)
        };
      }
    }

    // =========================================================================
    // 2. CHECAGEM DE QR CODE OFICIAL (CNH / CIN)
    // =========================================================================
    let qrCodeMatch = false;
    let qrCpfFound = null;

    if (qrData) {
      // Extrai CPF do QR Code (formato comum em URLs do SERPRO ou payload Vio)
      const cpfInQrMatch = qrData.match(/\b\d{11}\b/) || qrData.match(/cpf[=:]?(\d{11})/i);
      if (cpfInQrMatch) {
        qrCpfFound = cpfInQrMatch[1] || cpfInQrMatch[0];
        if (cleanExpectedDoc && qrCpfFound === cleanExpectedDoc) {
          qrCodeMatch = true;
        }
      }
    }

    // =========================================================================
    // 3. CHECAGEM DE CPF / CNPJ NO TEXTO DO DOCUMENTO
    // =========================================================================
    const cleanNumbersInText = unmask(normalizedText);
    let docNumberFound = false;

    if (cleanExpectedDoc && cleanExpectedDoc.length >= 8) {
      if (cleanNumbersInText.includes(cleanExpectedDoc) || qrCodeMatch) {
        docNumberFound = true;
      }
    }

    // =========================================================================
    // 4. CHECAGEM DE PALAVRAS-CHAVE GOVERNAMENTAIS / OFICIAIS
    // =========================================================================
    const relevantKeywords = DOC_KEYWORDS[category] || DOC_KEYWORDS.IDENTIFICATION;
    let keywordHits = 0;
    const foundKeywords = [];

    relevantKeywords.forEach((kw) => {
      const cleanKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedText.includes(cleanKw)) {
        keywordHits++;
        foundKeywords.push(kw);
      }
    });

    // =========================================================================
    // 4. CRUZAMENTO DE SÓCIOS E TITULARES (PJ / QSA) OU CPF (PF)
    // =========================================================================
    let partnerMatchedName = null;

    // Constrói lista de pessoas autorizadas para PJ
    let authorizedPartners = (expectedPartners || []).map(p => ({
      nome: p.nome || p.nome_socio || '',
      documento: p.documento || p.cpf_cnpj_socio || p.cnpj_cpf_do_socio || p.cpf_socio || p.cpf || p.cpfRepresentante || '',
      cpf_cnpj_socio: p.cpf_cnpj_socio || p.documento || '',
      cargo: p.cargo || p.qualificacao || p.qualificacao_socio || 'Sócio'
    })).filter(p => p.nome && p.nome.trim().length > 0);

    // Se a lista de sócios veio vazia do formulário (ex: ainda carregando), consulta a API na hora
    if (authorizedPartners.length === 0 && cleanExpectedDoc && cleanExpectedDoc.length === 14) {
      try {
        const directData = await fetchCNPJDataFromBrasilAPI(cleanExpectedDoc);
        if (directData?.socios && directData.socios.length > 0) {
          authorizedPartners = directData.socios.map(p => ({
            nome: p.nome || p.nome_socio || '',
            documento: p.documento || p.cpf_cnpj_socio || p.cnpj_cpf_do_socio || p.cpf_socio || p.cpf || p.cpfRepresentante || '',
            cpf_cnpj_socio: p.cpf_cnpj_socio || p.documento || '',
            cargo: p.cargo || p.qualificacao || p.qualificacao_socio || 'Sócio'
          })).filter(p => p.nome && p.nome.trim().length > 0);
        }
      } catch (e) {
        console.warn('Falha na busca direta de sócios:', e);
      }
    }

    // Adiciona titular da Razão Social se lista for vazia (MEI / Empresário Individual)
    if (authorizedPartners.length === 0 && expectedName) {
      const ownerFromRazao = extractOwnerFromRazaoSocial(expectedName);
      if (ownerFromRazao) {
        authorizedPartners.push({
          nome: ownerFromRazao,
          documento: '',
          cpf_cnpj_socio: '',
          cargo: 'Titular / Responsável Legal'
        });
      }
    }

    // Extrai todos os CPFs do texto (suporta 389.570.869-00, 389570869/00, 38957086900 etc)
    const foundCpfs = [];
    const cpfRegexes = [
      /\b\d{3}\.?\d{3}\.?\d{3}[-\/]?\d{2}\b/g,
      /\b\d{9}[-\/]\d{2}\b/g,
      /\b\d{11}\b/g,
      /cpf[^\d]*(\d{9,11}[-\/]?\d{0,2})/gi
    ];
    cpfRegexes.forEach(rgx => {
      const matches = fullRawText.match(rgx) || [];
      matches.forEach(m => {
        const clean = unmask(m);
        if (clean.length === 11 && !foundCpfs.includes(clean)) {
          foundCpfs.push(clean);
        }
      });
    });
    if (qrCpfFound && !foundCpfs.includes(qrCpfFound)) {
      foundCpfs.push(qrCpfFound);
    }

    // A) Cruzamento para Pessoa Jurídica (Sócio na CNH/RG)
    if (category === 'IDENTIFICATION' && (cleanExpectedDoc?.length === 14 || authorizedPartners.length > 0)) {
      for (const partner of authorizedPartners) {
        const matchRes = matchPartnerWithDocument(partner, {
          foundCpfs,
          fullRawText,
          normalizedText,
          qrData
        });

        if (matchRes.matched) {
          partnerMatchedName = matchRes.partnerName;
          break;
        }
      }

      // Se achou o sócio
      if (partnerMatchedName) {
        return {
          isValid: true,
          status: 'VERIFIED_MATCH',
          badge: 'Sócio Confirmado no CNPJ',
          message: `Documento oficial verificado! Sócio (${partnerMatchedName}) confirmado no CNPJ.`,
          details: 'Associação com o Quadro Societário (QSA) validada com sucesso.',
          score: 100,
          qrFound: Boolean(qrData)
        };
      }

      // Se NÃO achou nenhum sócio vinculado (MESMO que o documento seja uma CNH oficial!)
      return {
        isValid: false,
        isWarning: true,
        status: 'PARTNER_MISMATCH',
        badge: 'Sócio Não Vinculado ao CNPJ',
        message: 'O titular desta CNH/RG não foi localizado no Quadro de Sócios (QSA) deste CNPJ.',
        details: 'Por favor, anexe a CNH ou RG de um dos sócios administradores da empresa.',
        score: 20,
        qrFound: Boolean(qrData)
      };
    }

    // B) Cruzamento para Pessoa Física (CPF do titular)
    if (category === 'IDENTIFICATION' && cleanExpectedDoc?.length === 11) {
      if (docNumberFound || (qrCpfFound && qrCpfFound === cleanExpectedDoc)) {
        return {
          isValid: true,
          status: 'VERIFIED_MATCH',
          badge: 'Documento e CPF Conferidos',
          message: 'Documento oficial legível e CPF conferido com sucesso!',
          details: 'Dados do documento batem 100% com o cadastro.',
          score: 95,
          qrFound: Boolean(qrData)
        };
      }

      // Se encontrou outro CPF diferente
      if (foundCpfs.length > 0 && !foundCpfs.includes(cleanExpectedDoc)) {
        return {
          isValid: false,
          isWarning: true,
          status: 'CPF_MISMATCH',
          badge: 'CPF Divergente no Documento',
          message: `O documento contém o CPF ${maskCPF(foundCpfs[0])}, diferente do CPF cadastrado (${maskCPF(cleanExpectedDoc)}).`,
          details: 'Por favor, anexe o documento com foto pertencente ao titular do cadastro.',
          score: 20,
          qrFound: Boolean(qrData)
        };
      }
    }

    // C) Documento de Empresa / Contrato Social
    if (category === 'CONTRACT' && cleanExpectedDoc?.length === 14) {
      const foundCnpjs = extractCnpjsFromText(fullRawText);
      if (foundCnpjs.includes(cleanExpectedDoc) || unmask(fullRawText).includes(cleanExpectedDoc)) {
        return {
          isValid: true,
          status: 'VERIFIED_MATCH',
          badge: 'CNPJ da Empresa Confirmado',
          message: 'Contrato Social vinculado ao CNPJ cadastrado com sucesso!',
          details: 'Número de CNPJ conferido no documento.',
          score: 95,
          qrFound: Boolean(qrData)
        };
      }
    }

    // =========================================================================
    // 5. CLASSIFICAÇÃO GERAL / FALLBACK
    // =========================================================================
    if (keywordHits >= 2) {
      return {
        isValid: true,
        status: 'OFFICIAL_DOC',
        badge: 'Documento Legível',
        message: 'Documento anexado e legível para conferência interna.',
        details: `Termos detectados: ${foundKeywords.slice(0, 3).join(', ')}.`,
        score: 75,
        qrFound: Boolean(qrData)
      };
    }

    if (normalizedText.trim().length < 15 || keywordHits === 0) {
      return {
        isValid: true,
        isWarning: true,
        status: 'SUSPICIOUS_OR_BLURRY',
        badge: 'Atenção na Legibilidade',
        message: 'Não identificamos marcas de documento oficial nesta imagem.',
        details: 'Certifique-se de que a foto/PDF está bem iluminado e legível.',
        score: 30,
        qrFound: false
      };
    }

    return {
      isValid: true,
      status: 'ACCEPTED',
      badge: 'Arquivo Legível',
      message: 'Arquivo processado com sucesso.',
      details: 'Documento anexado pronto para envio.',
      score: 70,
      qrFound: false
    };

  } catch (error) {
    return {
      isValid: true,
      status: 'FALLBACK_OK',
      badge: 'Anexado com Sucesso',
      message: 'Arquivo anexado e pronto para envio.',
      details: 'Validação técnica será concluída pela equipe interna.',
      score: 50
    };
  }
}

/**
 * Extrai todos os CNPJs válidos de um texto
 * @param {string} text Texto bruto
 * @returns {string[]} Lista de CNPJs (somente dígitos)
 */
export function extractCnpjsFromText(text) {
  if (!text) return [];
  const found = new Set();

  // 1. Padrão formatado ou semi-formatado (ex: 51.101.372/0001-45 ou 51101372/0001-45)
  const formattedMatches = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || [];
  for (const m of formattedMatches) {
    const clean = unmask(m);
    if (clean.length === 14 && isValidCNPJ(clean)) {
      found.add(clean);
    }
  }

  // 2. Sequências de 14 dígitos contínuos
  const rawDigits = text.match(/\b\d{14}\b/g) || [];
  for (const m of rawDigits) {
    if (isValidCNPJ(m)) {
      found.add(m);
    }
  }

  return Array.from(found);
}

/**
 * Validação rigorosa do documento da empresa (Contrato Social / Cartão CNPJ / Requerimento de Empresário)
 * @param {File} file Arquivo anexado da empresa
 * @param {Object} options { expectedCnpj, expectedName, partnersList }
 * @returns {Promise<{isValid: boolean, isVerified: boolean, reasons: string[]}>}
 */
export async function validateCompanyAttachment(file, { expectedCnpj = '', expectedName = '', partnersList = [] } = {}) {
  if (!file) {
    return {
      isValid: false,
      isVerified: false,
      reasons: ['Nenhum documento da empresa foi anexado.']
    };
  }

  const cleanExpectedCnpj = unmask(expectedCnpj);

  try {
    const { Tesseract, jsQR, pdfjs } = await loadLibraries();

    let extractedText = '';
    let qrData = null;
    let canvasForOCR = null;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      const pdfResult = await processPDF(file, pdfjs, jsQR);
      extractedText = pdfResult.directText || '';
      qrData = pdfResult.qrData;
      canvasForOCR = pdfResult.canvas;
    } else {
      const imgResult = await imageToCanvas(file);
      canvasForOCR = imgResult.canvas;
      if (jsQR) {
        qrData = scanQRCodeFromCanvas(canvasForOCR, jsQR);
      }
    }

    // Se o texto for curto (scan ou foto), usa OCR com Tesseract
    if (extractedText.length < 50 && canvasForOCR) {
      const ocrResult = await Tesseract.recognize(canvasForOCR, 'por', {
        logger: () => {}
      });
      extractedText += ' ' + (ocrResult?.data?.text || '');
    }

    const fullRawText = `${extractedText} ${qrData || ''}`;
    const foundCnpjs = extractCnpjsFromText(fullRawText);

    // 1. CHECAGEM DE DIVERGÊNCIA DE CNPJ NO DOCUMENTO ANEXADO
    if (cleanExpectedCnpj && foundCnpjs.length > 0) {
      const hasExpectedCnpj = foundCnpjs.includes(cleanExpectedCnpj) || unmask(fullRawText).includes(cleanExpectedCnpj);
      if (!hasExpectedCnpj) {
        const divergentCnpj = foundCnpjs[0];
        return {
          isValid: false,
          isVerified: false,
          divergentCnpj,
          reasons: [
            `O documento anexado pertence a outro CNPJ (${maskCNPJ(divergentCnpj)}), diferente do CNPJ informado no formulário (${maskCNPJ(cleanExpectedCnpj)}).`,
            'Por favor, anexe o documento (Contrato Social ou Cartão CNPJ) correspondente ao mesmo CNPJ cadastrado.'
          ]
        };
      }
    }

    return {
      isValid: true,
      isVerified: foundCnpjs.includes(cleanExpectedCnpj),
      reasons: []
    };
  } catch (err) {
    console.warn('Erro ao validar documento da empresa:', err);
    return {
      isValid: true,
      isVerified: false,
      reasons: []
    };
  }
}

/**
 * Extrai o nome do titular a partir da Razão Social (para MEI, Empresário Individual, EIRELI)
 * Ex: "51.101.372 CAIO VINICIUS FERRAZ PRADO" -> "CAIO VINICIUS FERRAZ PRADO"
 * @param {string} razaoSocial 
 * @returns {string|null}
 */
export function extractOwnerFromRazaoSocial(razaoSocial) {
  if (!razaoSocial) return null;
  const cleanName = String(razaoSocial)
    .replace(/^[\d.\-\/]+\s+/, '')
    .replace(/\b(ltda|eireli|me|epp|s\/s|ss|s\.s\.|s\.a\.|sa|cia)\b/gi, '')
    .trim();

  const words = cleanName.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2) {
    return cleanName;
  }
  return null;
}

/**
 * Validação rigorosa do documento com foto do sócio (RG/CNH) contra o Quadro Societário (QSA)
 * @param {File} file Arquivo do documento com foto (RG ou CNH)
 * @param {Array} partnersList Lista de sócios obtidos da Direct Data / Receita Federal
 * @param {string} expectedCnpj CNPJ esperado para evitar anexo de CNPJ de terceiros
 * @param {string} expectedCompanyName Razão Social da empresa para identificação de titular
 * @returns {Promise<{isValid: boolean, isVerified: boolean, matchedPartner?: object, reasons: string[], authorizedPartners: string[], extractedInfo?: object}>}
 */
/**
 * Cruzamento inteligente de um sócio com os dados extraídos do documento (CNH/RG)
 * Suporta máscaras parciais oficiais da Receita Federal (ex: ***570869**) e tokens de nome
 * @param {object} partner 
 * @param {object} context 
 * @returns {{matched: boolean, matchType?: string, partnerName?: string, matchedPartner?: object}}
 */
export function matchPartnerWithDocument(partner, { foundCpfs = [], fullRawText = '', normalizedText = '', qrData = '' }) {
  if (!partner) return { matched: false };

  const rawDoc = partner.documento || partner.cpf_cnpj_socio || partner.cnpj_cpf_do_socio || partner.cpf_socio || partner.cpf || partner.cpfRepresentante || '';
  const partnerDocDigits = unmask(rawDoc);
  const partnerName = String(partner.nome || partner.nome_socio || '').trim();
  const cleanPartnerName = partnerName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // 1. CHECAGEM POR CPF (Suporta Máscara LGPD da Receita Federal: ex ***570869** e CPF de 11 dígitos)
  if (partnerDocDigits) {
    // Caso A: CPF completo de 11 dígitos
    if (partnerDocDigits.length === 11) {
      if (foundCpfs.includes(partnerDocDigits) || unmask(normalizedText).includes(partnerDocDigits)) {
        return { matched: true, matchType: 'CPF_EXACT', partnerName, matchedPartner: partner };
      }
    }
    // Caso B: Padrão Oficial LGPD da Receita Federal (6 dígitos do meio: ex 570869 de ***570869**)
    else if (partnerDocDigits.length === 6) {
      // Checa contra todos os CPFs de 11 dígitos extraídos da CNH / QR Code
      for (const extractedCpf of foundCpfs) {
        if (extractedCpf.length === 11) {
          // Posição canônica na CNH/RG: XXX.570.869-XX (substring índice 3 a 9)
          if (extractedCpf.substring(3, 9) === partnerDocDigits || extractedCpf.includes(partnerDocDigits)) {
            return { matched: true, matchType: 'CPF_LGPD_MASK', partnerName, matchedPartner: partner };
          }
        }
      }
      // Checa se os 6 dígitos aparecem no texto bruto da CNH / documento
      if (unmask(fullRawText).includes(partnerDocDigits)) {
        return { matched: true, matchType: 'CPF_LGPD_TEXT', partnerName, matchedPartner: partner };
      }
    }
    // Caso C: Outras máscaras parciais (>= 4 dígitos)
    else if (partnerDocDigits.length >= 4) {
      for (const extractedCpf of foundCpfs) {
        if (extractedCpf.includes(partnerDocDigits)) {
          return { matched: true, matchType: 'CPF_PARTIAL', partnerName, matchedPartner: partner };
        }
      }
      if (unmask(fullRawText).includes(partnerDocDigits)) {
        return { matched: true, matchType: 'CPF_PARTIAL_TEXT', partnerName, matchedPartner: partner };
      }
    }
  }

  // 2. CHECAGEM POR NOME DO SÓCIO
  if (cleanPartnerName.length > 3) {
    // Se o nome completo estiver contido no texto
    if (normalizedText.includes(cleanPartnerName)) {
      return { matched: true, matchType: 'NAME_FULL', partnerName, matchedPartner: partner };
    }

    const stopwords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'junior', 'filho', 'neto', 'sobrinho']);
    const nameTokens = cleanPartnerName
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopwords.has(t));

    if (nameTokens.length >= 2) {
      const matchedTokens = nameTokens.filter(token => normalizedText.includes(token));
      const matchCount = matchedTokens.length;
      const matchRatio = matchCount / nameTokens.length;

      // Se pelo menos 2 tokens significativos baterem (ex: "domingos" e "soares", ou "domingos" e "silva")
      // OU se a proporção for >= 50%
      if (matchCount >= 2 || matchRatio >= 0.5) {
        return { matched: true, matchType: 'NAME_TOKENS', partnerName, matchedPartner: partner };
      }
    } else if (nameTokens.length === 1 && nameTokens[0].length >= 4) {
      if (normalizedText.includes(nameTokens[0])) {
        return { matched: true, matchType: 'NAME_SINGLE_TOKEN', partnerName, matchedPartner: partner };
      }
    }
  }

  return { matched: false };
}

/**
 * Validação rigorosa do documento com foto do sócio (RG/CNH) contra o Quadro Societário (QSA)
 * @param {File} file Arquivo do documento com foto (RG ou CNH)
 * @param {Array} partnersList Lista de sócios obtidos da Direct Data / Receita Federal
 * @param {string} expectedCnpj CNPJ esperado para evitar anexo de CNPJ de terceiros
 * @param {string} expectedCompanyName Razão Social da empresa para identificação de titular
 * @returns {Promise<{isValid: boolean, isVerified: boolean, matchedPartner?: object, reasons: string[], authorizedPartners: string[], extractedInfo?: object}>}
 */
export async function validatePartnerDocument(file, partnersList = [], expectedCnpj = '', expectedCompanyName = '') {
  if (!file) {
    return {
      isValid: false,
      isVerified: false,
      reasons: ['Nenhum documento com foto do sócio foi anexado.'],
      authorizedPartners: (partnersList || []).map(p => p.nome || p.nome_socio).filter(Boolean)
    };
  }

  const cleanExpectedCnpj = unmask(expectedCnpj);
  let authorizedPartners = (partnersList || []).map(p => ({
    nome: p.nome || p.nome_socio || '',
    documento: p.documento || p.cpf_cnpj_socio || p.cnpj_cpf_do_socio || p.cpf_socio || p.cpf || p.cpfRepresentante || '',
    cpf_cnpj_socio: p.cpf_cnpj_socio || p.documento || '',
    cargo: p.cargo || p.qualificacao || p.qualificacao_socio || 'Sócio'
  })).filter(p => p.nome && p.nome.trim().length > 0);

  // Se a lista de sócios veio vazia, consulta a API na hora
  if (authorizedPartners.length === 0 && cleanExpectedCnpj && cleanExpectedCnpj.length === 14) {
    try {
      const directData = await fetchCNPJDataFromBrasilAPI(cleanExpectedCnpj);
      if (directData?.socios && directData.socios.length > 0) {
        authorizedPartners = directData.socios.map(p => ({
          nome: p.nome || p.nome_socio || '',
          documento: p.documento || p.cpf_cnpj_socio || p.cnpj_cpf_do_socio || p.cpf_socio || p.cpf || p.cpfRepresentante || '',
          cpf_cnpj_socio: p.cpf_cnpj_socio || p.documento || '',
          cargo: p.cargo || p.qualificacao || p.qualificacao_socio || 'Sócio'
        })).filter(p => p.nome && p.nome.trim().length > 0);
      }
    } catch (e) {
      console.warn('Falha na busca direta de sócios em validatePartnerDocument:', e);
    }
  }

  // Se não houver sócios no QSA (ex: MEI ou Empresário Individual), extrai o nome do titular da Razão Social
  if (authorizedPartners.length === 0 && expectedCompanyName) {
    const ownerFromRazao = extractOwnerFromRazaoSocial(expectedCompanyName);
    if (ownerFromRazao) {
      authorizedPartners.push({
        nome: ownerFromRazao,
        documento: '',
        cpf_cnpj_socio: '',
        cargo: 'Titular / Responsável Legal'
      });
    }
  }

  try {
    const { Tesseract, jsQR, pdfjs } = await loadLibraries();

    let extractedText = '';
    let qrData = null;
    let canvasForOCR = null;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      const pdfResult = await processPDF(file, pdfjs, jsQR);
      extractedText = pdfResult.directText || '';
      qrData = pdfResult.qrData;
      canvasForOCR = pdfResult.canvas;
    } else {
      const imgResult = await imageToCanvas(file);
      canvasForOCR = imgResult.canvas;
      if (jsQR) {
        qrData = scanQRCodeFromCanvas(canvasForOCR, jsQR);
      }
    }

    // Se o texto direto for curto (ex: foto ou scan), roda OCR com Tesseract
    if (extractedText.length < 50 && canvasForOCR) {
      const ocrResult = await Tesseract.recognize(canvasForOCR, 'por', {
        logger: () => {}
      });
      extractedText += ' ' + (ocrResult?.data?.text || '');
    }

    const fullRawText = `${extractedText} ${qrData || ''}`;
    const normalizedText = fullRawText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // 1. CHECAGEM DE CNPJ DIVERGENTE ANEXADO NO CAMPO DE SÓCIO
    if (cleanExpectedCnpj) {
      const foundCnpjs = extractCnpjsFromText(fullRawText);
      if (foundCnpjs.length > 0) {
        const hasExpected = foundCnpjs.includes(cleanExpectedCnpj) || unmask(fullRawText).includes(cleanExpectedCnpj);
        if (!hasExpected) {
          const divergentCnpj = foundCnpjs[0];
          return {
            isValid: false,
            isVerified: false,
            reasons: [
              `O documento anexado contém o CNPJ ${maskCNPJ(divergentCnpj)}, que não corresponde ao CNPJ informado no cadastro (${maskCNPJ(cleanExpectedCnpj)}).`,
              'Por favor, anexe a CNH ou RG de um dos sócios administradores autorizados.'
            ],
            authorizedPartners: authorizedPartners.map(p => p.nome)
          };
        }
      }
    }

    // Extrai todos os CPFs de 11 dígitos encontrados no texto / QR Code (suporta 389.570.869-00, 389570869/00 etc)
    const foundCpfs = [];
    const cpfRegexes = [
      /\b\d{3}\.?\d{3}\.?\d{3}[-\/]?\d{2}\b/g,
      /\b\d{9}[-\/]\d{2}\b/g,
      /\b\d{11}\b/g,
      /cpf[^\d]*(\d{9,11}[-\/]?\d{0,2})/gi
    ];
    cpfRegexes.forEach(rgx => {
      const matches = fullRawText.match(rgx) || [];
      matches.forEach(m => {
        const clean = unmask(m);
        if (clean.length === 11 && !foundCpfs.includes(clean)) {
          foundCpfs.push(clean);
        }
      });
    });

    if (qrData) {
      const qrCpfMatches = qrData.match(/\b\d{11}\b/g) || [];
      qrCpfMatches.forEach(c => {
        const clean = unmask(c);
        if (clean.length === 11 && !foundCpfs.includes(clean)) {
          foundCpfs.push(clean);
        }
      });
    }

    // 2. Cruzamento inteligente de sócio (CPF completo, Máscara LGPD ***570869** e Tokens do Nome)
    let matchedPartnerObj = null;
    let matchResultType = null;

    for (const partner of authorizedPartners) {
      const matchRes = matchPartnerWithDocument(partner, {
        foundCpfs,
        fullRawText,
        normalizedText,
        qrData
      });

      if (matchRes.matched) {
        matchedPartnerObj = matchRes.matchedPartner || partner;
        matchResultType = matchRes.matchType;
        break;
      }
    }

    if (matchedPartnerObj) {
      return {
        isValid: true,
        isVerified: true,
        matchType: matchResultType || 'VERIFIED',
        matchedPartner: matchedPartnerObj,
        reasons: [],
        authorizedPartners: authorizedPartners.map(p => p.nome)
      };
    }

    // Se nenhum sócio ou titular da empresa foi identificado no documento
    const partnersNamesList = authorizedPartners.map(p => p.nome);
    const reasons = [
      'O documento de identificação anexado (RG/CNH) não pertence a nenhum dos sócios registrados no Quadro Societário (QSA) deste CNPJ.',
      'Por favor, anexe a CNH ou RG de um dos sócios administradores autorizados.'
    ];

    return {
      isValid: false,
      isVerified: false,
      reasons,
      authorizedPartners: partnersNamesList,
      extractedInfo: {
        cpfsFound: foundCpfs.slice(0, 3)
      }
    };
  } catch (err) {
    console.warn('Falha técnica no cruzamento de sócio:', err);
    return {
      isValid: false,
      isVerified: false,
      reasons: [
        'Não foi possível confirmar o vínculo do documento do sócio com o CNPJ informado.',
        'Por favor, certifique-se de anexar uma foto ou PDF nítido da CNH ou RG de um dos sócios da empresa.'
      ],
      authorizedPartners: authorizedPartners.map(p => p.nome)
    };
  }
}

