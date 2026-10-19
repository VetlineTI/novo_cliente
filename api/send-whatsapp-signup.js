async function getEnvConfig() {
  const supabaseUrl = 
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    'https://zmojbzhqqoaliaeifwmz.supabase.co';

  const supabaseServiceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptb2piemhxcW9hbGlhZWlmd216Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzg4OTA0NCwiZXhwIjoyMDY5NDY1MDQ0fQ.orcSorHFRjWN5kDrcsn_WY8cZkJguPnVG8TcQsdpTXQ';

  const zapiInstanceId = 
    process.env.ZAPI_INSTANCE_ID || 
    '3FA30904FD3EB1CCD6A45A091FE8472E';

  const zapiToken = 
    process.env.ZAPI_TOKEN || 
    '3788FECBD27166EF12E5E25F';

  const zapiClientToken = 
    process.env.ZAPI_CLIENT_TOKEN || 
    'Fa6f8a0296d0542feabea4def38cc34edS';

  return {
    supabaseUrl,
    supabaseServiceKey,
    zapiInstanceId,
    zapiToken,
    zapiClientToken
  };
}

async function shortenUrl(longUrl) {
  if (!longUrl) return '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const short = (await res.text()).trim();
      if (short.startsWith('http://') || short.startsWith('https://')) {
        return short;
      }
    }
  } catch (err) {
    console.warn('Falha ao encurtar URL, mantendo link direto:', err?.message || err);
  }
  return longUrl;
}

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
    return res.status(405).json({ success: false, error: 'Método não permitido. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const isConfirmAction = 
      body.action === 'confirm' || 
      (req.query && req.query.action === 'confirm');

    const cleanEmail = String(body.email || (req.query && req.query.email) || '').trim().toLowerCase();

    const config = await getEnvConfig();
    const { supabaseUrl, supabaseServiceKey, zapiInstanceId, zapiToken, zapiClientToken } = config;

    // 0. Ação de Confirmação (ao clicar no link do WhatsApp)
    if (isConfirmAction && cleanEmail) {
      if (supabaseUrl && supabaseServiceKey) {
        try {
          // Busca o usuário pelo e-mail
          const listRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`, {
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            }
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const users = listData.users || [];
            const foundUser = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
            if (foundUser) {
              await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${foundUser.id}`, {
                method: 'PUT',
                headers: {
                  'apikey': supabaseServiceKey,
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  user_metadata: {
                    ...(foundUser.user_metadata || {}),
                    whatsapp_confirmed: true
                  },
                  email_confirm: true
                })
              });
            }
          }
        } catch (e) {
          console.warn('Erro ao atualizar usuário como confirmado:', e);
        }
      }

      return res.status(200).json({ success: true, message: 'WhatsApp confirmado com sucesso!' });
    }

    const { phone, fullName, password, redirectUrl } = body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanName = String(fullName || 'Cliente').trim();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'E-mail é obrigatório para gerar o link de confirmação.' });
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Número de telefone/WhatsApp inválido.' });
    }

    // Formata o telefone para o padrão DDI 55 (Brasil)
    let formattedPhone = cleanPhone;
    if (formattedPhone.length === 10 || formattedPhone.length === 11) {
      formattedPhone = `55${formattedPhone}`;
    } else if (formattedPhone.length === 12 || formattedPhone.length === 13) {
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = `55${formattedPhone}`;
      }
    }

    // Valida se as credenciais mínimas estão configuradas
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Chave administrativa SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL não configurada no servidor.'
      });
    }

    if (!zapiInstanceId || !zapiToken) {
      return res.status(500).json({
        success: false,
        error: 'Credenciais da Z-API (ZAPI_INSTANCE_ID ou ZAPI_TOKEN) não configuradas no servidor.'
      });
    }

    // 1. Gera o link de ativação via Supabase Admin REST API
    // Define a URL base pública de produção (evita enviar link de localhost para o WhatsApp do cliente)
    let baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || '';
    if (!baseUrl) {
      const incoming = (req.headers.origin || redirectUrl || '').trim();
      if (incoming && !incoming.includes('localhost') && !incoming.includes('127.0.0.1')) {
        baseUrl = incoming;
      } else {
        // Domínio oficial de produção na Vercel
        baseUrl = 'https://novocliente-ten.vercel.app';
      }
    }

    // Garante que a URL direciona diretamente para a tela de login
    const cleanBase = baseUrl.replace(/\/$/, '');
    const targetRedirect = cleanBase.includes('?') 
      ? `${cleanBase}&tab=login` 
      : `${cleanBase}/?tab=login`;

    let generatePayload = {
      type: 'signup',
      email: cleanEmail,
      options: {
        data: {
          full_name: cleanName
        },
        redirect_to: targetRedirect
      }
    };

    if (password) {
      generatePayload.password = String(password);
    }

    let genRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generatePayload)
    });

    let genData = await genRes.json().catch(() => ({}));

    // Se o usuário já estiver cadastrado no Supabase (status 422 "already been registered"),
    // atualizamos os metadados/senha se fornecidos e geramos um link de login/recuperação (magiclink)
    if (!genRes.ok && (genRes.status === 422 || String(genData.message || genData.msg || '').toLowerCase().includes('already been registered'))) {
      console.log(`Usuário ${cleanEmail} já existente no Supabase Auth. Atualizando e gerando magiclink...`);
      
      try {
        const listRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`, {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const users = listData.users || [];
          const foundUser = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
          if (foundUser) {
            const updatePayload = {
              user_metadata: {
                ...(foundUser.user_metadata || {}),
                full_name: cleanName || foundUser.user_metadata?.full_name || 'Cliente'
              }
            };
            if (password) {
              updatePayload.password = String(password);
            }
            await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${foundUser.id}`, {
              method: 'PUT',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatePayload)
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar usuário existente no Supabase:', err);
      }

      // Gera link de magiclink para o usuário existente
      const magicPayload = {
        type: 'magiclink',
        email: cleanEmail,
        options: {
          redirect_to: targetRedirect
        }
      };

      genRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(magicPayload)
      });

      genData = await genRes.json().catch(() => ({}));
    }

    if (!genRes.ok) {
      console.error('Erro ao gerar link no Supabase Admin:', genData);
      return res.status(genRes.status).json({
        success: false,
        error: genData.msg || genData.message || genData.error_description || 'Falha ao gerar link no Supabase'
      });
    }

    const actionLink = genData?.properties?.action_link || genData?.action_link;
    if (!actionLink) {
      return res.status(500).json({
        success: false,
        error: 'Supabase não retornou o link de confirmação (action_link).'
      });
    }

    // 2. Encurta o link para uma URL limpa e amigável no WhatsApp
    const displayLink = await shortenUrl(actionLink);

    // Monta a mensagem personalizada da Vetline
    const message = [
      `Olá, *${cleanName}*! 👋`,
      '',
      'Seja bem-vindo(a) à *Vetline Distribuidora*!',
      '',
      'Recebemos seu cadastro e preparamos seu acesso à *Área do Cliente*.',
      'Para confirmar sua conta e liberar seu acesso, clique no link seguro abaixo:',
      '',
      `👉 ${displayLink}`,
      '',
      '_Mensagem automática do Sistema de Credenciamento Vetline._'
    ].join('\n');

    // 3. Dispara a mensagem via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    const zapiHeaders = {
      'Content-Type': 'application/json'
    };
    if (zapiClientToken) {
      zapiHeaders['Client-Token'] = zapiClientToken;
    }

    const zapiRes = await fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({
        phone: formattedPhone,
        message: message
      })
    });

    const zapiData = await zapiRes.json().catch(() => ({}));

    if (!zapiRes.ok) {
      console.error('Erro na resposta da Z-API:', zapiData);
      return res.status(zapiRes.status).json({
        success: false,
        error: zapiData.message || zapiData.error || 'Falha ao enviar mensagem pela Z-API.',
        zapiDetails: zapiData
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Link de confirmação enviado via WhatsApp com sucesso!',
      phone: formattedPhone,
      zapiResponse: zapiData
    });

  } catch (error) {
    console.error('Erro inesperado no envio de WhatsApp signup:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno no servidor ao processar envio de WhatsApp.'
    });
  }
}
