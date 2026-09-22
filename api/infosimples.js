// Serverless Function para Vercel: Proxy para API Infosimples
// Evita bloqueio 403 de Cloudflare/WAF e problemas de CORS em produção

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // Normaliza o corpo da requisição (URL-encoded ou JSON)
    let bodyData = '';
    if (typeof req.body === 'string') {
      bodyData = req.body;
    } else if (req.body && typeof req.body === 'object') {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      bodyData = params.toString();
    }

    const targetUrl = `https://api.infosimples.com/api/v2/consultas/${service}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Vetline-Bureau-App/1.0'
      },
      body: bodyData
    });

    const responseData = await response.json();
    return res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Erro no proxy da Infosimples:', error);
    return res.status(500).json({
      code: 500,
      code_message: 'Erro interno no proxy do servidor',
      errors: [error.message || 'Falha na comunicação com a API Infosimples']
    });
  }
}
