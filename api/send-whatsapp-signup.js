async function getEnvConfig() {
  const supabaseUrl = 
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL;

  const supabaseServiceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const zapiInstanceId = 
    process.env.ZAPI_INSTANCE_ID;

  const zapiToken = 
    process.env.ZAPI_TOKEN;

  const zapiClientToken = 
    process.env.ZAPI_CLIENT_TOKEN;

  return {
    supabaseUrl,
    supabaseServiceKey,
    zapiInstanceId,
    zapiToken,
    zapiClientToken
  };
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

  // Parse de query parameters
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
  }
  body = body || {};

  const isConfirmRedirect = 
    query.action === 'confirm_redirect' || 
    body.action === 'confirm_redirect';

  const isConfirmAction = 
    isConfirmRedirect ||
    query.action === 'confirm' || 
    body.action === 'confirm';

  if (req.method !== 'POST' && !isConfirmAction) {
    return res.status(405).json({ success: false, error: 'Método não permitido. Use POST.' });
  }

  try {
    const cleanEmail = String(body.email || query.email || '').trim().toLowerCase();
    const config = await getEnvConfig();
    const { supabaseUrl, supabaseServiceKey, zapiInstanceId, zapiToken, zapiClientToken } = config;

    // Define a URL base pública de produção
    let baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || '';
    if (!baseUrl) {
      const incoming = (req.headers.origin || '').trim();
      if (incoming && !incoming.includes('localhost') && !incoming.includes('127.0.0.1')) {
        baseUrl = incoming;
      } else {
        baseUrl = 'https://novocliente-ten.vercel.app';
      }
    }

    // 0. Ação de Confirmação (ao clicar no link do WhatsApp ou chamada direta via API)
    if (isConfirmAction && cleanEmail) {
      if (supabaseUrl && supabaseServiceKey) {
        try {
          // 1. Marca imediatamente whatsapp_confirmed: true na tabela novo_cliente.data_new_cliente via service_role
          await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/data_new_cliente?email=eq.${encodeURIComponent(cleanEmail)}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
              'Accept-Profile': 'novo_cliente',
              'Content-Profile': 'novo_cliente'
            },
            body: JSON.stringify({ whatsapp_confirmed: true })
          }).catch(errTab => console.warn('Erro ao atualizar whatsapp_confirmed em data_new_cliente:', errTab));

          // 2. REGRA DE NEGÓCIO PRINCIPAL: Envio imediato para o ERP Moinho via n8n e aprovação com cd_clien
          try {
            // Busca o registro completo e mais recente do cliente no schema novo_cliente
            const clientFullRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/data_new_cliente?email=eq.${encodeURIComponent(cleanEmail)}&select=*&order=criado_em.desc.nullslast&limit=1`, {
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Accept-Profile': 'novo_cliente'
              }
            });

            if (clientFullRes.ok) {
              const fullList = await clientFullRes.json();
              const clientRecord = fullList && fullList[0];

              if (clientRecord) {
                // Se o cliente já possui código no ERP (cd_clien), não reenvia para evitar duplicidade
                if (clientRecord.cd_clien) {
                  console.log(`Cliente ${cleanEmail} já possui cd_clien (${clientRecord.cd_clien}). Envio duplicado ignorado.`);
                } else {
                  const n8nWebhookUrl = 
                    process.env.N8N_MOINHO_WEBHOOK_URL || 
                    'https://n8n.srv1055305.hstgr.cloud/webhook/novo-cliente-moinho';
                  
                  const n8nSecret = 
                    process.env.N8N_WEBHOOK_SECRET || 
                    process.env.INTERNAL_API_SECRET || 
                    '';

                  const moinhoPayload = {
                    event: 'CLIENT_APPROVED',
                    action: 'confirmar_cadastro',
                    timestamp: new Date().toISOString(),
                    aprovado_por: 'whatsapp_confirm_auto',
                    origem: 'whatsapp_click',
                    cliente: {
                      id: clientRecord.id,
                      auth_user_id: clientRecord.auth_user_id || null,
                      tipo_pessoa: clientRecord.tipo_pessoa || 'PJ',
                      cpf_cnpj: clientRecord.cpf_cnpj || '',
                      razao_social_nome: clientRecord.razao_social_nome || '',
                      nome_fantasia: clientRecord.nome_fantasia || '',
                      tp_inscricao: clientRecord.tp_inscricao || (clientRecord.tipo_pessoa === 'PF' ? 'I' : 'E'),
                      numero_inscricao: clientRecord.numero_inscricao || clientRecord.numero_ie || 'ISENTO',
                      crmv: clientRecord.crmv || null,
                      telefone: clientRecord.telefone || '',
                      email: clientRecord.email || '',
                      segmento: clientRecord.segmento || clientRecord.ram_ativ || '',
                      ram_ativ: clientRecord.ram_ativ || clientRecord.segmento || '',
                      cd_vend: clientRecord.cd_vend || 'ATENA',
                      tab_pre: clientRecord.tab_pre || 'VTL01',
                      tp_ped: clientRecord.tp_ped || 'VTL01',
                      condicao_pagamento: (clientRecord.condicao_pagamento !== null && clientRecord.condicao_pagamento !== undefined && clientRecord.condicao_pagamento !== '') ? Number(clientRecord.condicao_pagamento) : null,
                      praz_medio: (clientRecord.praz_medio !== null && clientRecord.praz_medio !== undefined && clientRecord.praz_medio !== '') ? Number(clientRecord.praz_medio) : null,
                      limite_credito: Number(clientRecord.limite_credito || 0),
                      cep: clientRecord.cep || '',
                      logradouro: clientRecord.logradouro || '',
                      numero: clientRecord.numero || '',
                      complemento: clientRecord.complemento || '',
                      bairro: clientRecord.bairro || '',
                      cidade: clientRecord.cidade || '',
                      uf: clientRecord.uf || '',
                      endereco_entrega_diferente: Boolean(clientRecord.endereco_entrega_diferente),
                      entrega_cep: clientRecord.entrega_cep || null,
                      entrega_logradouro: clientRecord.entrega_logradouro || null,
                      entrega_numero: clientRecord.entrega_numero || null,
                      entrega_complemento: clientRecord.entrega_complemento || null,
                      entrega_bairro: clientRecord.entrega_bairro || null,
                      entrega_cidade: clientRecord.entrega_cidade || null,
                      entrega_uf: clientRecord.entrega_uf || null,
                      doc_contrato_social_url: clientRecord.doc_contrato_social_url || null,
                      doc_identificacao_url: clientRecord.doc_identificacao_url || null,
                      doc_crmv_url: clientRecord.doc_crmv_url || null,
                      doc_comprovante_endereco_url: clientRecord.doc_comprovante_endereco_url || null,
                      doc_ie_url: clientRecord.doc_ie_url || null,
                      doc_jucesp_url: clientRecord.doc_jucesp_url || null,
                      doc_cenprot_url: clientRecord.doc_cenprot_url || null,
                      doc_sipeagro_url: clientRecord.doc_sipeagro_url || null,
                      tem_sipeagro: Boolean(clientRecord.tem_sipeagro),
                      nire_jucesp: clientRecord.nire_jucesp || null,
                      status: 'aprovado',
                      observacoes: clientRecord.observacoes || '',
                      approved_at: new Date().toISOString(),
                      created_at: clientRecord.criado_em || clientRecord.created_at || null
                    }
                  };

                  const headers = {
                    'Content-Type': 'application/json'
                  };
                  if (n8nSecret) {
                    headers['X-Webhook-Secret'] = n8nSecret;
                    headers['Authorization'] = `Bearer ${n8nSecret}`;
                  }

                  console.log(`Disparando envio ao ERP Moinho para ${cleanEmail}...`);
                  const n8nResponse = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(moinhoPayload)
                  });

                  const responseText = await n8nResponse.text();
                  console.log(`Resposta do n8n Moinho (${n8nResponse.status}):`, responseText);
                  let responseData = null;
                  try {
                    responseData = JSON.parse(responseText);
                  } catch (_) {
                    responseData = responseText;
                  }

                  const items = Array.isArray(responseData) ? responseData : (responseData && typeof responseData === 'object' ? [responseData] : []);
                  const item = items[0] || {};
                  const cdClien = item.cd_clien ?? item.CD_CLIEN ?? item.cd_cliente ?? null;

                  // Atualização segura no banco: apenas campos existentes na tabela data_new_cliente
                  const dbUpdates = {
                    status: 'aprovado',
                    whatsapp_confirmed: true
                  };

                  if (cdClien) {
                    dbUpdates.cd_clien = String(cdClien);
                    console.log(`Cliente ${cleanEmail} cadastrado no ERP Moinho com cd_clien: ${cdClien}`);
                  } else if (item.resultado === 'JA_EXISTE' || String(item.resultado || '').toLowerCase().includes('existe')) {
                    console.log(`Cliente ${cleanEmail} já existia no ERP Moinho (resultado: ${item.resultado})`);
                    const curObs = clientRecord.observacoes || '';
                    if (!curObs.includes('Já existente no ERP')) {
                      dbUpdates.observacoes = curObs ? `${curObs} | [Moinho: Já existente no ERP]` : `[Moinho: Já existente no ERP]`;
                    }
                  }

                  if (item.error) {
                    console.warn(`Aviso do n8n/Moinho para cliente ${clientRecord.id}:`, item.error);
                    const curObs = clientRecord.observacoes || '';
                    dbUpdates.observacoes = curObs ? `${curObs} | [Moinho: ${item.error}]` : `[Moinho: ${item.error}]`;
                  }

                  const patchRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/data_new_cliente?id=eq.${clientRecord.id}`, {
                    method: 'PATCH',
                    headers: {
                      'apikey': supabaseServiceKey,
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=minimal',
                      'Accept-Profile': 'novo_cliente',
                      'Content-Profile': 'novo_cliente'
                    },
                    body: JSON.stringify(dbUpdates)
                  });

                  if (!patchRes.ok) {
                    const patchErr = await patchRes.text();
                    console.error('Erro no PATCH data_new_cliente:', patchRes.status, patchErr);
                  } else {
                    console.log(`Cliente ${cleanEmail} atualizado com sucesso no Supabase com status='aprovado'${cdClien ? ` e cd_clien='${cdClien}'` : ''}.`);
                  }
                }
              }
            }
          } catch (eMoinho) {
            console.error('Erro ao enviar cliente ao Moinho na confirmação de WhatsApp:', eMoinho);
          }

          // 3. Auditoria de Sócios e Protestos Direct Data (executado de forma segura sem travar resposta)
          try {
            const clientQueryRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/data_new_cliente?email=eq.${encodeURIComponent(cleanEmail)}&select=id,cpf_cnpj,tipo_pessoa,uf,doc_cenprot_url,doc_receita_url`, {
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Accept-Profile': 'novo_cliente'
              }
            });

            if (clientQueryRes.ok) {
              const clientList = await clientQueryRes.json();
              const targetClient = clientList && clientList[0];

              if (targetClient && targetClient.cpf_cnpj && (!targetClient.doc_cenprot_url || !targetClient.doc_receita_url)) {
                const docClean = String(targetClient.cpf_cnpj).replace(/\D/g, '');
                const directToken = process.env.DIRECTD_TOKEN || '12DC14EA-112C-426C-9EC9-05A1280D23D1';
                const isPJ = docClean.length === 14;

                const auditUpdates = {
                  bureau_consulted_at: new Date().toISOString()
                };

                // Consulta Protestos na Direct Data
                try {
                  const protRes = await fetch(`https://apiv3.directd.com.br/api/ProtestosOnline?${isPJ ? 'CNPJ' : 'CPF'}=${docClean}&TOKEN=${directToken}&gerarComprovante=true`);
                  if (protRes.ok) {
                    const protData = await protRes.json();
                    if (protData?.retorno && (protData.metaDados?.resultadoId === 1 || protData.metaDados?.resultadoId === 2)) {
                      const numP = protData.retorno.numeroTotalProtestos ?? 0;
                      auditUpdates.total_protestos = numP;
                      auditUpdates.limite_credito = numP === 0 ? (isPJ ? 3000.00 : 1500.00) : 0.00;

                      // Regra de Condição de Pagamento e Prazo Médio (Vetline ERP)
                      // 1. CPF ou CNPJ com protesto: condição 6 e prazo 28
                      // 2. CPF sem protesto: condição 49 e prazo 28
                      // 3. CNPJ sem protesto até 6 meses de abertura: condição 6 e prazo 14
                      // 4. CNPJ sem protesto mais de 6 meses de abertura: condição 49 e prazo 28
                      if (numP > 0) {
                        auditUpdates.condicao_pagamento = 6;
                        auditUpdates.praz_medio = 28;
                      } else {
                        if (!isPJ) {
                          auditUpdates.condicao_pagamento = 49;
                          auditUpdates.praz_medio = 28;
                        } else {
                          const dtAbertura = targetClient.data_abertura || targetClient.data_inicio_atividade;
                          let isAte6Meses = false;
                          if (dtAbertura) {
                            const d = new Date(dtAbertura);
                            if (!isNaN(d.getTime())) {
                              const diffDays = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                              isAte6Meses = diffDays >= 0 && diffDays <= 180;
                            }
                          }
                          auditUpdates.condicao_pagamento = isAte6Meses ? 6 : 49;
                          auditUpdates.praz_medio = isAte6Meses ? 14 : 28;
                        }
                      }

                      if (protData.metaDados?.urlComprovante) {
                        auditUpdates.doc_cenprot_url = protData.metaDados.urlComprovante;
                      }
                    }
                  }
                } catch (eProt) {
                  console.warn('Erro ao consultar Protestos na Direct Data:', eProt);
                }

                // Salva certidões no banco se coletou algo
                if (Object.keys(auditUpdates).length > 1) {
                  await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/data_new_cliente?id=eq.${targetClient.id}`, {
                    method: 'PATCH',
                    headers: {
                      'apikey': supabaseServiceKey,
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=minimal',
                      'Accept-Profile': 'novo_cliente',
                      'Content-Profile': 'novo_cliente'
                    },
                    body: JSON.stringify(auditUpdates)
                  }).catch(() => {});
                }
              }
            }
          } catch (eAudit) {
            console.warn('Erro na auditoria Direct Data:', eAudit);
          }

        } catch (e) {
          console.warn('Erro no processamento da confirmação:', e);
        }
      }

      // Se for o redirecionamento oficial ao clicar no link do WhatsApp, redireciona para a tela do portal
      if (isConfirmRedirect) {
        const destUrl = `${baseUrl.replace(/\/$/, '')}/?confirmed=whatsapp&email=${encodeURIComponent(cleanEmail)}`;
        res.setHeader('Location', destUrl);
        return res.status(302).end();
      }

      return res.status(200).json({ success: true, message: 'WhatsApp confirmado e cadastro enviado ao Moinho com sucesso!' });
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
    if (!baseUrl) {
      const incoming = (req.headers.origin || redirectUrl || '').trim();
      if (incoming && !incoming.includes('localhost') && !incoming.includes('127.0.0.1')) {
        baseUrl = incoming;
      } else {
        // Domínio oficial de produção na Vercel
        baseUrl = 'https://novocliente-ten.vercel.app';
      }
    }

    // Link direto e oficial de confirmação cadastral da Vetline (sem necessidade de criação em auth.users)
    const cleanBase = baseUrl.replace(/\/$/, '');
    const confirmLink = `${cleanBase}/api/send-whatsapp-signup?action=confirm_redirect&email=${encodeURIComponent(cleanEmail)}`;

    // 2. Monta a mensagem personalizada da Vetline com o link oficial de confirmação
    const message = [
      `Olá, *${cleanName}*! 👋`,
      '',
      'Seja bem-vindo(a) à *Vetline Distribuidora*!',
      '',
      'Recebemos sua solicitação de cadastro comercial.',
      'Para validar seus dados cadastrais, toque no link seguro abaixo:',
      '',
      `👉 ${confirmLink}`,
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
