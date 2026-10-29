// Serverless Function para Vercel & Vite: Proxy Seguro para API Direct Data
// - Injeta o token secretamente do servidor via process.env.DIRECTD_TOKEN
// - O token NUNCA é exposto ou aceito do navegador do cliente
// - Proteção contra requisições simultâneas/duplicadas (In-Flight Lock & Debounce)

const requestHistory = new Map(); // chave -> { timestamp, data }
const inFlightRequests = new Map(); // chave -> Promise

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

// Limpa cache periodicamente para liberar memória
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of requestHistory.entries()) {
    if (now - item.timestamp > 60000) {
      requestHistory.delete(key);
    }
  }
}, 30000).unref?.();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const service = req.query.service || req.query.path || 'CadastroPessoaJuridicaPlus';

    if (service === 'ReceitaPJParticipacaoSocietaria') {
      return res.status(410).json({
        metaDados: {
          resultadoId: 410,
          resultado: 'Endpoint desativado',
          mensagem: 'O endpoint ReceitaPJParticipacaoSocietaria foi desativado e não deve mais ser utilizado.'
        },
        retorno: null
      });
    }

    // Token estritamente do servidor (nunca do cliente)
    const directdToken = process.env.DIRECTD_TOKEN;
    if (!directdToken) {
      return res.status(500).json({
        metaDados: {
          resultadoId: 500,
          resultado: 'Configuração incompleta',
          mensagem: 'Variável de ambiente DIRECTD_TOKEN não configurada no servidor.'
        },
        retorno: null
      });
    }

    // Identifica o documento consultado para travar concorrência
    const rawDoc = req.query.CNPJ || req.query.CPF || req.query.documento || '';
    const cleanDoc = String(rawDoc).replace(/\D/g, '');
    const clientIp = getClientIp(req);
    const lockKey = `${service}_${cleanDoc || clientIp}`;

    const now = Date.now();

    // 1. Se já existe uma requisição idêntica em andamento, aguarda ela terminar (evita 8 requisições no mesmo segundo)
    if (inFlightRequests.has(lockKey)) {
      try {
        const sharedResponse = await inFlightRequests.get(lockKey);
        return res.status(200).json(sharedResponse);
      } catch (err) {
        // Se a anterior falhou, prossegue normalmente
      }
    }

    // 2. Se a mesma requisição acabou de ser feita há menos de 5 segundos, devolve cache recente
    if (cleanDoc && requestHistory.has(lockKey)) {
      const prev = requestHistory.get(lockKey);
      if (now - prev.timestamp < 5000 && prev.data) {
        return res.status(200).json(prev.data);
      }
    }

    const queryParams = new URLSearchParams();

    // Monta os parâmetros seguros ignorando qualquer tentativa de passar token pelo navegador
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'service' && key !== 'path' && key.toUpperCase() !== 'TOKEN' && value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }

    // Injeta o token oficial do servidor
    queryParams.append('TOKEN', directdToken);

    const targetUrl = `https://apiv3.directd.com.br/api/${service}?${queryParams.toString()}`;

    // Cria a promessa e adiciona ao mapa de concorrência
    const fetchPromise = (async () => {
      const response = await fetch(targetUrl, {
        method: req.method || 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Vetline-Bureau-App/1.0'
        }
      });
      const responseData = await response.json();
      return { status: response.status, data: responseData };
    })();

    inFlightRequests.set(lockKey, fetchPromise.then(r => r.data));

    try {
      const { status, data } = await fetchPromise;

      // Guarda no histórico recente
      requestHistory.set(lockKey, { timestamp: Date.now(), data });

      return res.status(status).json(data);
    } finally {
      inFlightRequests.delete(lockKey);
    }

  } catch (error) {
    console.error('Erro no proxy seguro da Direct Data:', error);
    return res.status(500).json({
      metaDados: {
        resultadoId: 500,
        resultado: 'Erro no proxy do servidor',
        mensagem: error.message || 'Falha na comunicação com a API Direct Data'
      },
      retorno: null
    });
  }
}
