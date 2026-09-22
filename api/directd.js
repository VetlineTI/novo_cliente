// Serverless Function para Vercel: Proxy para API Direct Data
// Evita bloqueios de CORS em ambiente de produção na Vercel

export default async function handler(req, res) {
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

  try {
    const service = req.query.service || req.query.path || 'CadastroPessoaJuridicaPlus';
    const queryParams = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'service' && key !== 'path' && value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }

    const targetUrl = `https://apiv3.directd.com.br/api/${service}?${queryParams.toString()}`;

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vetline-Bureau-App/1.0'
      }
    });

    const responseData = await response.json();
    return res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Erro no proxy da Direct Data:', error);
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
