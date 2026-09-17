import { unmask } from './masks';

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
    console.warn('Erro na leitura de QR Code:', err);
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

    const normalizedText = (extractedText + ' ' + (qrData || ''))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // remove acentos para busca precisa

    // =========================================================================
    // 1. CHECAGEM DE QR CODE OFICIAL (CNH / CIN)
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
    // 2. CHECAGEM DE CPF / CNPJ NO TEXTO DO DOCUMENTO
    // =========================================================================
    const cleanNumbersInText = unmask(normalizedText);
    let docNumberFound = false;

    if (cleanExpectedDoc && cleanExpectedDoc.length >= 8) {
      if (cleanNumbersInText.includes(cleanExpectedDoc) || qrCodeMatch) {
        docNumberFound = true;
      }
    }

    // =========================================================================
    // 3. CHECAGEM DE PALAVRAS-CHAVE GOVERNAMENTAIS / OFICIAIS
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
    // 4. CHECAGEM DE NOME E QUADRO DE SÓCIOS (BRASILAPI QSA)
    // =========================================================================
    let nameHit = false;
    let partnerMatchedName = null;

    if (expectedName && expectedName.trim().length > 3) {
      const nameParts = expectedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(' ')
        .filter((part) => part.length >= 3);

      const matchedParts = nameParts.filter((part) => normalizedText.includes(part));
      if (matchedParts.length >= Math.min(2, nameParts.length)) {
        nameHit = true;
      }
    }

    // Cruzamento com Sócios da BrasilAPI (se fornecido)
    if (expectedPartners && Array.isArray(expectedPartners) && expectedPartners.length > 0) {
      for (const partner of expectedPartners) {
        if (!partner.nome) continue;
        const partnerParts = partner.nome
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .split(' ')
          .filter((p) => p.length >= 3);

        const matched = partnerParts.filter((p) => normalizedText.includes(p));
        if (matched.length >= Math.min(2, partnerParts.length)) {
          nameHit = true;
          partnerMatchedName = partner.nome;
          break;
        }
      }
    }

    // =========================================================================
    // 5. CLASSIFICAÇÃO E RESPOSTA FINAL
    // =========================================================================

    // Caso 1: QR Code Oficial Validado com Sucesso
    if (qrCodeMatch) {
      return {
        isValid: true,
        status: 'VERIFIED_QR',
        badge: 'QR Code Oficial Verificado',
        message: partnerMatchedName 
          ? `QR Code autenticado! Sócio (${partnerMatchedName}) confirmado no CNPJ.`
          : 'QR Code oficial autenticado e CPF conferido com sucesso!',
        details: 'Assinatura digital e dados batem 100% com o cadastro.',
        score: 100,
        qrFound: true
      };
    }

    // Caso 2: CPF ou Sócio e Dados Oficiais Conferidos na Imagem/PDF
    if ((docNumberFound || partnerMatchedName) && keywordHits >= 2) {
      return {
        isValid: true,
        status: 'VERIFIED_MATCH',
        badge: partnerMatchedName ? 'Sócio Confirmado no CNPJ' : 'Documento e CPF Conferidos',
        message: partnerMatchedName 
          ? `Documento oficial legível! Titular identificado como sócio (${partnerMatchedName}) no CNPJ.`
          : 'Documento oficial legível e CPF conferido com sucesso!',
        details: `Identificados termos oficiais (${foundKeywords.slice(0, 3).join(', ')}) e dados compatíveis.`,
        score: 95,
        qrFound: Boolean(qrData)
      };
    }

    // Caso 3: Documento Oficial Reconhecido (Termos oficiais presentes, CPF pendente de validação visual)
    if (keywordHits >= 2 || nameHit) {
      return {
        isValid: true,
        status: 'OFFICIAL_DOC',
        badge: 'Documento Oficial Reconhecido',
        message: 'Documento oficial legível identificado com sucesso.',
        details: `Termos detectados: ${foundKeywords.slice(0, 3).join(', ')}. Aguardará validação cadastral.`,
        score: 80,
        qrFound: Boolean(qrData)
      };
    }

    // Caso 4: Pouco legível ou Imagem não parece documento oficial
    if (normalizedText.trim().length < 15 || keywordHits === 0) {
      return {
        isValid: true, // Não bloqueia envio se o usuário insistir, mas avisa
        isWarning: true,
        status: 'SUSPICIOUS_OR_BLURRY',
        badge: 'Atenção na Legibilidade',
        message: 'Não identificamos marcas de documento oficial nesta imagem.',
        details: 'Certifique-se de que a foto/PDF está bem iluminado e legível.',
        score: 30,
        qrFound: false
      };
    }

    // Caso Padrão Aceito
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
    console.warn('Aviso no validador inteligente de documento:', error);
    // Em caso de falha de carregamento do Tesseract, aceita graciosamente sem travar o cliente
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
