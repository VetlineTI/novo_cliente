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
          // 1. Atualiza a coluna whatsapp_confirmed na tabela novo_cliente.data_new_cliente via service_role
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
          }).catch(errTab => console.warn('Erro ao atualizar tabela data_new_cliente:', errTab));

          // 2. Atualiza o usuário no Supabase Auth
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

              // Atualiza também buscando por auth_user_id se necessário
              await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/data_new_cliente?auth_user_id=eq.${encodeURIComponent(foundUser.id)}`, {
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
              }).catch(() => {});
            }
          }

          // 3. REGRA DE NEGÓCIO: Consulta oficial de Sócios e Protestos na Direct Data ao confirmar o WhatsApp
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
                      if (protData.metaDados?.urlComprovante) {
                        auditUpdates.doc_cenprot_url = protData.metaDados.urlComprovante;
                      } else {
                        const protHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certidão de Protestos</title><style>body{font-family:sans-serif;padding:24px;background:#f8fafc;}.card{background:#fff;padding:24px;border:2px solid #0f172a;border-radius:8px;}.badge{padding:12px;border-radius:6px;font-weight:bold;margin:12px 0;background:${numP === 0 ? '#dcfce7;color:#166534;' : '#fee2e2;color:#991b1b;'}}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;}</style></head><body><div class="card"><h2>Central Nacional de Protestos (IEPTB / CENPROT)</h2><p><b>Documento Consultado:</b> ${protData.retorno.documentoConsultado || docClean}</p><div class="badge">${numP === 0 ? '✓ NADA CONSTA - 0 Protestos' : `⚠ CONSTAM ${numP} PROTESTO(S) - Total: ${protData.retorno.valorTotalProtestos || 'R$ 0,00'}`}</div><p style="font-size:11px;color:#64748b;margin-top:16px;">Documento oficial emitido via Direct Data em ${new Date().toLocaleString('pt-BR')}</p></div></body></html>`;
                        auditUpdates.doc_cenprot_url = 'data:text/html;charset=utf-8,' + encodeURIComponent(protHtml);
                      }
                    }
                  }
                } catch (eProt) {
                  console.warn('Erro ao consultar Protestos na Direct Data:', eProt);
                }

                // Se for PJ, consulta Sócios da Receita Federal e PJ Plus
                if (isPJ) {
                  try {
                    const recRes = await fetch(`https://apiv3.directd.com.br/api/ReceitaPJParticipacaoSocietaria?CNPJ=${docClean}&TOKEN=${directToken}&gerarComprovante=true`);
                    if (recRes.ok) {
                      const recData = await recRes.json();
                      if (recData?.retorno) {
                        if (recData.metaDados?.urlComprovante) {
                          auditUpdates.doc_receita_url = recData.metaDados.urlComprovante;
                        } else {
                          const socios = Array.isArray(recData.retorno.socios) ? recData.retorno.socios : [];
                          const sociosRows = socios.map(s => `<tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${s.nomeEntidade || s.nome || '-'}</td><td style="padding:8px;border:1px solid #cbd5e1;">${s.qualificacao || 'Sócio'}</td><td style="padding:8px;border:1px solid #cbd5e1;">${s.documento || '-'}</td></tr>`).join('');
                          const recHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receita Federal - Sócios</title><style>body{font-family:sans-serif;padding:24px;background:#f8fafc;}.card{background:#fff;padding:24px;border:2px solid #0f766e;border-radius:8px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;}</style></head><body><div class="card"><h2>Receita Federal - Quadro de Sócios e Administradores (QSA)</h2><p><b>Empresa:</b> ${recData.retorno.nomeEmpresarial || recData.retorno.razaoSocial || ''} (${docClean})</p><p><b>Situação Cadastral:</b> ${recData.retorno.situacaoCadastral || 'Ativa'} | <b>Data de Abertura:</b> ${recData.retorno.dataAbertura || ''}</p><table><thead><tr><th>Nome do Sócio</th><th>Qualificação</th><th>Documento</th></tr></thead><tbody>${sociosRows || '<tr><td colspan="3">Nenhum sócio informado</td></tr>'}</tbody></table><p style="font-size:11px;color:#64748b;margin-top:16px;">Comprovante oficial gerado via Direct Data em ${new Date().toLocaleString('pt-BR')}</p></div></body></html>`;
                          auditUpdates.doc_receita_url = 'data:text/html;charset=utf-8,' + encodeURIComponent(recHtml);
                        }
                      }
                    }
                  } catch (eRec) {
                    console.warn('Erro ao consultar Sócios da Receita:', eRec);
                  }

                  try {
                    const plusRes = await fetch(`https://apiv3.directd.com.br/api/CadastroPessoaJuridicaPlus?CNPJ=${docClean}&TOKEN=${directToken}&gerarComprovante=true`);
                    if (plusRes.ok) {
                      const plusData = await plusRes.json();
                      if (plusData?.retorno && plusData.metaDados?.urlComprovante) {
                        auditUpdates.doc_jucesp_url = plusData.metaDados.urlComprovante;
                      }
                    }
                  } catch (ePlus) {}
                }

                // Salva no banco de dados via service_role
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
                }).catch(ePatch => console.warn('Erro ao atualizar dados de auditoria no Supabase:', ePatch));
              }
            }
          } catch (eAudit) {
            console.warn('Erro ao disparar auditoria Direct Data na ativação:', eAudit);
          }
        } catch (e) {
          console.warn('Erro ao atualizar usuário como confirmado:', e);
        }
      }

      // Se for o redirecionamento oficial ao clicar no link do WhatsApp, joga direto para a tela de login
      if (isConfirmRedirect) {
        const destUrl = `${baseUrl.replace(/\/$/, '')}/?tab=login&activated=true&email=${encodeURIComponent(cleanEmail)}`;
        res.setHeader('Location', destUrl);
        return res.status(302).end();
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
    if (!baseUrl) {
      const incoming = (req.headers.origin || redirectUrl || '').trim();
      if (incoming && !incoming.includes('localhost') && !incoming.includes('127.0.0.1')) {
        baseUrl = incoming;
      } else {
        // Domínio oficial de produção na Vercel
        baseUrl = 'https://novocliente-ten.vercel.app';
      }
    }

    // Garante que o redirecionamento passe pela rota confirm_redirect da API para atualizar a coluna no banco na hora
    const cleanBase = baseUrl.replace(/\/$/, '');
    const targetRedirect = `${cleanBase}/api/send-whatsapp-signup?action=confirm_redirect&email=${encodeURIComponent(cleanEmail)}`;

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

    // 2. Monta a mensagem personalizada da Vetline com o link oficial do Supabase
    const message = [
      `Olá, *${cleanName}*! 👋`,
      '',
      'Seja bem-vindo(a) à *Vetline Distribuidora*!',
      '',
      'Recebemos seu cadastro e preparamos seu acesso à *Área do Cliente*.',
      'Para confirmar sua conta e liberar seu acesso, clique no link seguro abaixo:',
      '',
      `👉 ${actionLink}`,
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
