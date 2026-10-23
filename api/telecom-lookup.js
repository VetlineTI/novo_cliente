/**
 * Serverless API: /api/telecom-lookup
 * Realiza auditoria e validação de linha telefônica via Twilio Lookups API v2.
 * Consulta simultânea de VOIP (line_type_intelligence) e SIM Swap (troca recente de chip).
 * 
 * Regra: Esta validação é informativa/auditoria e NÃO bloqueia o cadastro do cliente.
 */

export default async function handler(req, res) {
  // CORS Headers
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

  // Parse Body & Query
  let query = req.query || {};
  if (req.url && req.url.includes('?')) {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      query = { ...Object.fromEntries(urlObj.searchParams.entries()), ...query };
    } catch (e) {}
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  } else if (!body) {
    body = {};
  }

  const rawPhone = body.phone || body.telefone || query.phone || query.telefone;
  if (!rawPhone) {
    return res.status(400).json({
      success: false,
      error: 'Telefone não informado para consulta telecom.'
    });
  }

  // Formatação para E.164 (+55...)
  const digits = String(rawPhone).replace(/\D/g, '');
  let e164 = '';
  if (digits.length === 10 || digits.length === 11) {
    e164 = `+55${digits}`;
  } else if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    e164 = `+${digits}`;
  } else if (digits.length > 8) {
    e164 = `+${digits}`;
  } else {
    return res.status(400).json({
      success: false,
      error: 'Número de telefone inválido (poucos dígitos).'
    });
  }

  // Credenciais Twilio via variáveis de ambiente (.env)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;

  const authUser = apiKey || accountSid;
  const authPass = apiSecret || authToken;
  const basicAuth = Buffer.from(`${authUser}:${authPass}`).toString('base64');

  try {
    const twilioUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence,sim_swap`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(twilioUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Twilio Lookup] Resposta HTTP ${response.status}:`, errText);
      return res.status(200).json({
        success: false,
        warning: `Twilio Lookup retornou status ${response.status}`,
        error: errText,
        phone: e164,
        is_voip: false,
        sim_swapped_recently: false
      });
    }

    const data = await response.json();
    const lineIntel = data.line_type_intelligence || {};
    const simSwap = data.sim_swap || {};

    const lineType = lineIntel.type || 'unknown'; // mobile, landline, voip, fixedVoip, etc.
    const carrierName = lineIntel.carrier_name || 'Desconhecida';
    const isVoip = lineType.toLowerCase().includes('voip');
    const isMobile = lineType === 'mobile';
    const isLandline = lineType === 'landline';

    // Verificação de SIM Swap
    let simSwappedRecently = false;
    let simSwapStatus = 'ok';
    let lastSimSwapDate = simSwap.last_sim_swap || null;

    if (simSwap.error_code) {
      if (simSwap.error_code === 10002) {
        simSwapStatus = 'trial_account_limitation'; // Conta trial requer upgrade para SIM Swap
      } else {
        simSwapStatus = `error_${simSwap.error_code}`;
      }
    } else if (simSwap.swapped_in_period === true) {
      simSwappedRecently = true;
      simSwapStatus = 'swapped_recently';
    } else if (simSwap.swapped_in_period === false) {
      simSwapStatus = 'stable';
    }

    // Nível de Risco Telecom
    let riskLevel = 'baixo';
    const alerts = [];

    if (isVoip) {
      riskLevel = 'alto';
      alerts.push('Linha virtual/VOIP identificada (número não fixado a chip físico).');
    }
    if (simSwappedRecently) {
      riskLevel = 'alto';
      alerts.push('Troca recente de chip detectada (SIM Swap) nas últimas horas.');
    }
    if (isLandline) {
      alerts.push('Linha de telefonia fixa (não recebe SMS convencional).');
    }

    return res.status(200).json({
      success: true,
      phone: e164,
      national_format: data.national_format || rawPhone,
      valid: data.valid !== false,
      carrier: carrierName,
      line_type: lineType,
      is_voip: isVoip,
      is_mobile: isMobile,
      is_landline: isLandline,
      sim_swapped_recently: simSwappedRecently,
      last_sim_swap_date: lastSimSwapDate,
      sim_swap_status: simSwapStatus,
      risk_level: riskLevel,
      alerts,
      checked_at: new Date().toISOString()
    });

  } catch (err) {
    console.warn('[Twilio Lookup] Erro na requisição:', err.message);
    // Em caso de falha de conexão/timeout, responde sem quebrar o fluxo
    return res.status(200).json({
      success: false,
      error: err.message,
      phone: e164,
      is_voip: false,
      sim_swapped_recently: false,
      risk_level: 'indeterminado',
      alerts: []
    });
  }
}
