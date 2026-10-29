// Serverless Function para Vercel & Vite: Proxy Seguro para API Infosimples
// - Injeta o token secretamente do servidor via process.env.INFOSIMPLES_TOKEN
// - O token NUNCA é exposto ou aceito do navegador do cliente
// - Proteção contra requisições simultâneas/duplicadas (In-Flight Lock)

const requestHistory = new Map();
const inFlightRequests = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

// Limpa cache periodicamente
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const service = req.query.service || req.query.path || '';
    if (!service) {
      return res.status(400).json({ error: 'Parâmetro de serviço não informado na URL.' });
    }

    const infosimplesToken = process.env.INFOSIMPLES_TOKEN;
    if (!infosimplesToken) {
      return res.status(500).json({
        code: 500,
        code_message: 'Configuração incompleta',
        errors: ['Variável de ambiente INFOSIMPLES_TOKEN não configurada no servidor.']
      });
    }

    // Trava de concorrência por serviço e query
    const clientIp = getClientIp(req);
    let queryKey = '';

    const params = new URLSearchParams();

    // Extrai parâmetros do corpo ignorando qualquer token enviado pelo navegador
    if (typeof req.body === 'string') {
      const parsed = new URLSearchParams(req.body);
      for (const [key, value] of parsed.entries()) {
        if (key.toLowerCase() !== 'token') {
          params.append(key, value);
          if (['query', 'cnpj', 'cpf', 'documento'].includes(key.toLowerCase())) {
            queryKey = value;
          }
        }
      }
    } else if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined && value !== null && key.toLowerCase() !== 'token') {
          params.append(key, String(value));
          if (['query', 'cnpj', 'cpf', 'documento'].includes(key.toLowerCase())) {
            queryKey = String(value);
          }
        }
      }
    }

    const lockKey = `${service}_${queryKey || clientIp}`;

    // 1. In-Flight Lock: se já tem uma idêntica em andamento, aguarda
    if (inFlightRequests.has(lockKey)) {
      try {
        const sharedResponse = await inFlightRequests.get(lockKey);
        return res.status(200).json(sharedResponse);
      } catch (err) {}
    }

    // Injeta o token oficial do servidor
    params.append('token', infosimplesToken);

    const bodyData = params.toString();
    const targetUrl = `https://api.infosimples.com/api/v2/consultas/${service}`;

    const fetchPromise = (async () => {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Vetline-Bureau-App/1.0'
        },
        body: bodyData
      });
      const responseData = await response.json();
      return { status: response.status, data: responseData };
    })();

    inFlightRequests.set(lockKey, fetchPromise.then(r => r.data));

    try {
      const { status, data } = await fetchPromise;
      return res.status(status).json(data);
    } finally {
      inFlightRequests.delete(lockKey);
    }

  } catch (error) {
    console.error('Erro no proxy seguro da Infosimples:', error);
    return res.status(500).json({
      code: 500,
      code_message: 'Erro interno no proxy do servidor',
      errors: [error.message || 'Falha na comunicação com a API Infosimples']
    });
  }
}
