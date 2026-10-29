# 🐾 Vetline - Portal de Credenciamento, Área do Cliente & Painel Administrativo

Aplicação web moderna, intuitiva e altamente responsiva para credenciamento, login, autoatendimento e gestão de clientes (Pessoa Física e Pessoa Jurídica) da **Vetline Distribuidora de Produtos Veterinários**, integrada com **React**, **Tailwind CSS** e banco de dados **Supabase** no schema **`novo_cliente`** (tabelas `data_new_client`, `admin_profiles` e integração com `auth.users`).

---

## 📸 Funcionalidades e Regras de Negócio

### 1. 🔑 Tela Inicial com Abas ("Já sou cliente" & "Ainda não sou")
- A rota principal (`/`) oferece um seletor moderno de abas:
  - **Aba "Já sou cliente"**: Formulário de login direto com e-mail e senha cadastrados no Supabase Auth, permitindo acesso imediato à Área do Cliente.
  - **Aba "Ainda não sou"**: Formulário completo de credenciamento e apresentação institucional da Vetline.

### 2. 🛡️ Criação de Senha & Confirmação Obrigatória via WhatsApp (Z-API)
- Ao preencher o formulário e clicar em **"Enviar cadastro"**, o sistema abre o modal **"Acesso à Área do Cliente"** (`CreatePasswordModal`).
- O usuário confirma o **e-mail para login** e define sua **senha de acesso**.
- O sistema registra o cliente no **Supabase Auth (`auth.users`)** com metadado `whatsapp_confirmed: false` e salva os dados cadastrais na tabela `novo_cliente.data_new_client`.
- **Disparo Automático via Z-API**: Gera o link oficial de signup com token do Supabase Admin e dispara a mensagem no WhatsApp do cliente.
- **Ativação Obrigatória no App**:
  - Para acessar a Área do Cliente, é **obrigatório** tocar no link seguro enviado no WhatsApp.
  - Se tentar logar antes de clicar no link, o sistema exibe alerta amigável de pendência e oferece o botão para **"Reenviar link no WhatsApp"**.
  - Ao clicar no link do WhatsApp, a aplicação detecta o token, marca a conta como ativada (`whatsapp_confirmed: true`), dispara a consulta oficial de **Protestos em Cartório / Bureau** para o cliente ativado e libera o acesso à Área do Cliente.
  - **Zero desperdício de créditos de API**: A consulta de protestos não é chamada prematuramente no formulário; ela ocorre estritamente para clientes que concluíram o cadastro e deram o aceite no WhatsApp.
  - **Zero impacto nos demais sistemas**: A verificação é controlada na camada da aplicação, mantendo a flag global do Supabase desligada para não interferir em outros apps.

### 3. 👤 Portal & Área do Cliente (`ClientDashboard`)
- Painel exclusivo para o cliente autenticado acompanhar e gerenciar seu cadastro:
  - **Acompanhamento de Status em Tempo Real**:
    - 🔵 **Em Análise (Status Inicial Obrigatório)**: Ao se cadastrar, o cliente ingressa diretamente como `em_analise` (o status "pendente" foi extinto), com processo de checagem documental e validação cadastral ativo.
    - 🟢 **Aprovado**: Boas-vindas com exibição das condições comerciais, tabela de preço liberada (`VTL01`) e vendedor responsável.
    - 🔴 **Necessita Correções (Recusado)**: Exibição clara das notas/parecer do analista para que o cliente ajuste os dados e reenvie documentos.
  - **Edição de Dados Cadastrais com Verificação Obrigatória de Segurança**:
    - Ao tentar salvar alterações no perfil cadastral, o sistema aciona o fluxo guiado (`ClientVerificationModal`) de verificação sequencial:
      1. **Telefone**: Pergunta se o telefone/WhatsApp permanece o mesmo (se não, permite digitar e validar o novo número);
      2. **E-mail**: Pergunta se o e-mail permanece o mesmo (se não, permite digitar e validar o novo e-mail);
      3. **Endereço**: Pergunta se o endereço cadastral permanece o mesmo (se não, abre os campos com busca automática de CEP por ViaCEP).
    - Caso o usuário responda "Sim" para todos, avança direto e grava as alterações no banco de dados.
  - **Documentos & Reenvio de Anexos**:
    - Visualização dos arquivos já enviados com suporte a zoom e rotação.
    - Botão **"Substituir / Enviar documento"** para reenvio direto de arquivos ao Supabase Storage.
  - **Atendimento e Suporte**: Canal direto via WhatsApp integrado com os dados do cliente.

### 4. 🏢 Regras Cadastrais (PF & PJ)
- **Tipo de Pessoa**: Seleção entre Pessoa Jurídica (PJ) e Pessoa Física (PF).
- **Tipo de Inscrição (`tp_inscricao`) & Número (`numero_inscricao`) - Exclusivo para PJ**:
  - Opções de Tipo: **Estadual** (`'E'`), **Isento** (`'I'`) ou **Municipal** (`'M'`).
  - Quando selecionado **Isento** (`'I'`), o campo do número de inscrição fica automaticamente preenchido como `"ISENTO"` e desabilitado para edição.
  - Quando selecionado **Estadual** (`'E'`) ou **Municipal** (`'M'`), permite preencher o número correspondente.
  - Gravação no banco de dados Supabase: coluna `tp_inscricao` (`'E'`, `'I'` ou `'M'`) e coluna `numero_inscricao` (o número digitado ou `"ISENTO"`).
- **CRMV (Número do Registro Profissional & Validação Documental) - Exclusivo para PF**:
  - Para Pessoa Física (PF), não são exibidos os campos de tipo e número de inscrição (sendo salvo automaticamente no banco como `tp_inscricao: 'I'` e `numero_inscricao: 'ISENTO'`).
  - Em seu lugar, é exibido o campo obrigatório de texto **CRMV** (armazenado na coluna `crmv`).
  - **Validação de Situação no CFMV & Bloqueio Preventivo**: Consulta em tempo real na API Infosimples (`/cfmv/cadastro`). Enquanto o CRMV não obtiver retorno positivo de **Ativo/Regular**, os campos subsequentes (contato, endereço, upload de anexos e envio) permanecem **bloqueados**. Se o CRMV retornar inativo, suspenso ou cancelado, é exibido alerta vermelho de impedimento e os campos não são liberados.
  - **Cruzamento com o Documento Anexado**: Extração inteligente via OCR (Tesseract / PDF.js) da carteira/cédula do CRMV anexada para conferir se o número do registro profissional no documento coincide com o CRMV informado no formulário, alertando e bloqueando divergências.
- **Pessoa Jurídica (PJ)**: Consulta automática na Receita Federal via BrasilAPI ao digitar o CNPJ, preenchendo Razão Social, CNAE, Situação Cadastral e Sócios. Anexo de Contrato Social OU Documento do Sócio (pelo menos 1 obrigatório).
- **Pessoa Física (PF)**: Validação de CPF e obrigatoriedade do número e anexo da carteira do CRMV (Médico Veterinário) + Comprovante de Endereço.
- **Segmentos de Atuação (`ram_ativ` & `descricao`)**: Lista de segmentos carregada dinamicamente da tabela `novo_cliente.segmento` exibindo a `descricao` amigável no formulário e gravando o código `ram_ativ` no banco de dados.
- **Endereço Principal & Entrega**: Preenchimento automático via CEP (BrasilAPI / ViaCEP).
- **Vendedor Responsável (`cd_vend`)**: Seleção de vendedor da tabela `public.vendedor` ou padrão `'ATENA'`.

### 5. 👑 Painel Administrativo (`/admin`)
- Rota dedicada para administradores e analistas de cadastro da Vetline.
- Contadores de status, filtros rápidos por PJ/PF e busca textual inteligente.
- Edição cadastral e comercial completa (`tab_pre`, `tp_ped`, `cd_vend`, status e parecer interno `notes`).
- **Alerta de Retaguarda para CNPJs Recentes (< 1 ano de fundação)**: A aplicação extrai automaticamente a data de abertura da Receita Federal (`data_inicio_atividade`). Quando a empresa possui menos de 365 dias de fundação, o sistema exibe um banner de alerta âmbar em destaque no modal de detalhes, renderiza aviso nos cards da listagem, injeta observação automática na coluna `notes` e anexa o aviso no texto do campo `alerta` integrado ao ERP Moinho.
- Organização em **Pastas de Documentos** e visualizador integrado de PDFs e imagens.
- **Gestão de Usuários & Perfis**: Listagem dos usuários de `auth.users` via RPC e concessão de perfis (Administrador, Operador, Consulta ou Bloqueado).
- **Integração Webhook N8N (Moinho)**: Ao clicar em **"Confirmar & Aprovar"** ou aprovar o cadastro no painel, o sistema dispara automaticamente o webhook `https://n8n.srv1055305.hstgr.cloud/webhook/novo-cliente-moinho` com a carga completa de dados do cliente (dados cadastrais, fiscais, endereço, vendedor, tabelas comerciais e URLs dos anexos).

### 6. 📱 Auditoria Telecom & Prevenção a Fraudes (Twilio Lookups v2: VOIP & SIM Swap)
- **Validação no Envio de Senha**: Ao finalizar a criação de senha e submeter o formulário de cadastro, o sistema consulta a **Twilio Lookups API v2** em segundo plano (`/api/telecom-lookup`).
- **Não Impeditivo**: Conforme regra de negócio, a verificação **NÃO bloqueia o cadastro** do cliente, garantindo taxa de conversão fluida.
- **Detecção de Linha VOIP / Virtual**: Identifica números de telefonia em nuvem/descartáveis frequentemente utilizados em tentativas de fraude.
- **Detecção de Troca Recente de Chip (SIM Swap)**: Verifica se o chip/IMSI da linha móvel sofreu substituição recente nas operadoras nacionais (Claro, Vivo, TIM).
- **Badges de Alerta na Retaguarda**:
  - Na listagem do **Admin Dashboard**: Badges compactos indicando operadora real (`📱 Vivo`, `📱 Claro`), alerta vermelho pulsante `⚠️ VOIP / Virtual` ou aviso `⚠️ SIM Swap Recente`.
  - No modal de detalhes (**ClientDetailModal**): Banner dedicado de **Alerta Telecom (Antifraude)** com instruções de compliance e identificação detalhada ao lado do número de telefone.

### 7. ⚖️ Central de Políticas, LGPD & Gestão de Cookies
- **Central de Políticas Unificada (`TermsModal.jsx`)**:
  - Modal interativo e responsivo com navegação em abas:
    - **Termos de Uso**: Condições gerais de fornecimento, credenciamento técnico, obrigações de recebimento de produtos refrigerados (2°C a 8°C) e botão de download/visualização do documento oficial em PDF (`/docs/termo_de_uso.pdf`).
    - **Privacidade & LGPD**: Detalhamento da finalidade de tratamento de dados sob a Lei nº 13.709/2018 para cumprimento de obrigações legais (MAPA, Receita e CRMV), segurança antifraude e canal de contato do DPO (`privacidade@vetline.com.br`).
    - **Política de Cookies**: Tabela informativa com categorias de cookies estritamente essenciais para funcionamento do Supabase Auth e integridade de formulários.
- **Banner de Consentimento de Cookies (`CookieConsentBanner.jsx`)**:
  - Notificação flutuante com opções para aceitar todos os cookies ou apenas essenciais, com gravação de preferência em `localStorage` (`vetline_cookie_consent`).
  - Possibilidade de revisão das preferências a qualquer momento através dos links do rodapé do sistema.
- **Aceite Formal Integrado ao Cadastro (`RegistrationForm.jsx`)**:
  - Checkbox obrigatório no credenciamento com links diretos para leitura dos Termos de Uso e da Política de Privacidade.
  - Suporte a download do PDF oficial assim que o arquivo `termo_de_uso.pdf` for adicionado à pasta `public/docs/`.

---

## 📂 Estrutura de Arquivos

| Arquivo / Diretório | Descrição |
| :--- | :--- |
| `index.html` | Estrutura HTML principal com fontes do Google Fonts (*Plus Jakarta Sans* e *Inter*) e metatags. |
| `package.json` | Dependências do projeto (React, Lucide React, Supabase JS, Canvas Confetti, Tailwind CSS). |
| `vite.config.js` | Configuração de build e desenvolvimento do Vite com proxies locais e serverless handlers. |
| `vercel.json` | Configuração de rewrites para suporte a SPA e rotas diretas na Vercel. |
| `supabase/schema.sql` | Script SQL completo com schema `novo_cliente`, `data_new_cliente` (colunas em Português BR), `admin_profiles`, `auth_user_id`, RPCs de usuários e Storage. |
| `supabase/rename_columns_to_ptbr.sql` | Script de migração para renomear todas as colunas da tabela de clientes para Português BR no Supabase. |
| `supabase/fix_auth_trigger.sql` | Correção definitiva do trigger `handle_new_auth_user()` e criação de view de compatibilidade para evitar erro 500 no cadastro. |
| `supabase/add_bureau_columns.sql` | Script SQL para adicionar as colunas do Bureau e Certidões (JUCESP, CENPROT e Receita Federal) no Supabase. |
| `supabase/add_inscricao_and_crmv_columns.sql` | Script SQL completo para criação das colunas `tp_inscricao`, `numero_inscricao`, `crmv` e atualização das RPCs. |
| `supabase/add_data_abertura_column.sql` | Script SQL para adicionar as colunas `data_abertura` e `data_inicio_atividade`, atualizar RPCs e recarregar o schema cache no Supabase. |
| `supabase/migrate_from_public.sql` | Script de migração segura de dados de `public.data_new_client` para `novo_cliente.data_new_cliente`. |
| `supabase/fix_rls_security.sql` | Script SQL de correção definitiva de segurança e LGPD nas políticas de RLS de `data_new_cliente` (revogação de SELECT/UPDATE anônimo e criação de RPC segura). |
| `supabase/templates/confirm_signup.html` | Template HTML profissional e responsivo para e-mail de ativação de cadastro com cores da Vetline e logo oficial. |
| `supabase/templates/reset_password.html` | Template HTML profissional para e-mail de recuperação de senha com identidade visual Vetline. |
| `api/infosimples.js` | Serverless Function para Vercel: Proxy seguro para consultas à API Infosimples (evita 403 e CORS). |
| `api/directd.js` | Serverless Function para Vercel: Proxy seguro para consultas à API Direct Data (evita CORS). |
| `api/send-whatsapp-signup.js` | Serverless Function para Vercel: Gera link oficial de ativação via Supabase Admin e dispara confirmação via WhatsApp pela Z-API. |
| `api/telecom-lookup.js` | Serverless Function para Vercel: Consulta simultânea na Twilio Lookups v2 (VOIP / Tipo de Linha e SIM Swap). |
| `docs/INTEGRACAO_ASSERTIVA.md` | Especificação técnica e guia de migração para a API da Assertiva Soluções (OAuth2, Score, Ações, Protestos e Dossiê de Crédito). |
| `src/main.jsx` | Ponto de entrada da aplicação React. |
| `src/App.jsx` | Roteamento dinâmico entre Portal do Cliente (`/`), Área do Cliente Logado e Painel Administrativo (`/admin`). |
| `src/lib/supabase.js` | Conexão com Supabase no schema `novo_cliente`, upload no bucket `novos_clientes`, persistência e atualização de cadastros. |
| `src/lib/clientAuth.js` | Módulo de autenticação do cliente (Supabase Auth, ativação por e-mail, login, atualização cadastral e reenvio de anexos). |
| `src/lib/zapi.js` | Módulo de integração com a Z-API para disparo do link de confirmação de cadastro no WhatsApp do cliente. |
| `src/lib/telecom.js` | Módulo cliente e utilitários para consulta, extração e formatação de badges de telecomunicações (VOIP e SIM Swap). |
| `src/lib/adminAuth.js` | Módulo de autenticação com Supabase Auth para a equipe administrativa e gestão de perfis. |
| `src/lib/infosimples.js` | Módulo de integração com APIs de bureau (JUCESP Ficha Simplificada, CENPROT Protestos e SINTEGRA). |
| `src/lib/directd.js` | Módulo de integração com a API Direct Data: `CadastroPessoaJuridicaPlus` (Ficha Cadastral e Sócios), `ProtestosOnline` (IEPTB / CENPROT Nacional) e `Sintegra` (Consulta e validação cadastral estadual com comprovante em PDF). |
| `src/components/Header.jsx` | Cabeçalho com logo Vetline, indicador de segurança, identificação da sessão do cliente e link para Admin. |
| `src/components/LeftSidebar.jsx` | Painel lateral de benefícios institucionais da Vetline. |
| `src/components/RegistrationForm.jsx` | Formulário reativo de credenciamento com validações de negócio, checagem antecipada de Sócios (QSA) e Sintegra, e acionamento de criação de senha. |
| `src/components/CreatePasswordModal.jsx` | Modal de definição de senha do cliente com validações e aviso de ativação por e-mail. |
| `src/components/SuccessModal.jsx` | Modal de confirmação com orientações de verificação do e-mail de ativação e botão para ir ao login. |
| `src/components/TermsModal.jsx` | Central oficial de termos e políticas em abas (Termos de Uso, Privacidade & LGPD e Cookies) com botão para download de PDF oficial. |
| `src/components/CookieConsentBanner.jsx` | Banner flutuante de consentimento de cookies e conformidade LGPD com opções essenciais/todos e persistência local. |
| `public/docs/README.md` | Diretório de documentos e PDFs estáticos oficiais da Vetline (ex: `termo_de_uso.pdf`). |
| `src/components/PartnerMismatchModal.jsx` | Modal de alerta de divergência cadastral e societária (QSA / SINTEGRA) com motivos de não aprovação e botão de ação. |
| `src/components/SegmentHelpModal.jsx` | Modal com guia descritivo e tabela de identificação de todos os segmentos de atuação. |
| `src/components/DocumentUpload.jsx` | Componente de upload de documentos com drag & drop e câmera integrada. |
| `src/components/client/ClientPortalAuth.jsx` | Tela principal com as abas **"Já sou cliente"** e **"Ainda não sou"**. |
| `src/components/client/ClientLogin.jsx` | Formulário de login do cliente com banner de ativação, tratamento de conta pendente e reenvio de e-mail. |
| `src/components/client/ForgotPasswordModal.jsx` | Modal de solicitação de recuperação de senha via envio de link para o e-mail cadastrado. |
| `src/components/client/ResetPasswordModal.jsx` | Modal de criação de nova senha para usuários que acessam o link de recuperação. |
| `src/components/client/ClientDashboard.jsx` | Painel do cliente logado com acompanhamento de status, edição de dados e reenvio de documentos. |
| `src/components/client/ClientVerificationModal.jsx` | Modal interativo de verificação obrigatória de Telefone, E-mail e Endereço ao salvar edições cadastrais. |
| `src/components/admin/AdminLogin.jsx` | Tela de login administrativo com Supabase Auth e credenciais de emergência. |
| `src/components/admin/AdminDashboard.jsx` | Painel de controle administrativo com listagem de clientes e gestão de perfis. |
| `src/components/admin/ClientDetailModal.jsx` | Visualização detalhada do cliente organizada em pastas e aprovações. |
| `src/components/admin/DocumentViewerModal.jsx` | Visualizador de alta resolução para documentos com suporte a URLs assinadas seguras (Signed URLs), zoom, rotação e download. |
| `src/components/admin/UserManagementView.jsx` | Módulo de listagem de usuários do `auth.users` e concessão de perfis. |
| `supabase/setup_storage_private.sql` | Script SQL para configurar o bucket `novos_clientes` como **Privado** no Supabase Storage com políticas de RLS (upload público e leitura autenticada). |
| `supabase/add_rate_limit.sql` | Script SQL de Rate Limiting por IP (tabela `rate_limit_logs`, RPCs `check_rate_limit` e `log_rate_limit_attempt`) para proteção nativa contra spam e abuso de cadastros. |
| `supabase/add_limite_credito.sql` | Script SQL para adicionar a coluna `limite_credito` (`NUMERIC(12,2) DEFAULT 0.00`) no schema `novo_cliente` com retrocompatibilidade e recálculo inicial. |
| `supabase/add_cnae_columns.sql` | Script SQL para adicionar as colunas de CNAE (`cnae`, `cnae_codigo`, `cnae_descricao`) no schema `novo_cliente` com atualização da view de compatibilidade. |
| `src/utils/masks.js` | Funções de máscara para CPF, CNPJ, Telefone, CEP e tamanhos de arquivo. |
| `src/utils/validators.js` | Algoritmos de validação de CPF, CNPJ, e-mail, extração padronizada de CNAE e consulta de CEP. |
| `src/utils/cnaeValidator.js` | Módulo de validação e catálogo com os 24 CNAEs homologados pela Vetline, formatação e verificação de não-conformidade. |
| `src/utils/bruteForceProtector.js` | Módulo de proteção contra força bruta no login (limite de 5 tentativas com bloqueio temporário de 5 minutos e contagem regressiva). |
| `src/utils/documentValidator.js` | Validador inteligente de anexos com OCR multi-orientação (0°, 90°, 270°) e leitura de QR Code. |

### 6. ⚠️ Validação de CNAEs Permitidos & Alerta no Painel Administrativo
- O sistema extrai automaticamente o CNAE Principal da empresa via API da Receita Federal (Direct Data / Minha Receita / BrasilAPI / CNPJ.ws) durante o cadastro.
- No **Painel Administrativo** (`AdminDashboard` e `ClientDetailModal`), o CNAE é confrontado com a lista oficial de 24 atividades econômicas homologadas:
  - **4789-0/04** - Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação
  - **4771-7/04** - Comércio varejista de medicamentos veterinários
  - **9609-2/08** - Higiene e embelezamento de animais domésticos
  - **7500-1/00** - Atividades veterinárias
  - **4623-1/01** - Comércio atacadista de animais vivos
  - **4623-1/09** - Comércio atacadista de matérias-primas agrícolas não especificadas anteriormente
  - **4632-0/01** - Comércio atacadista de cereais e leguminosas beneficiados
  - **4646-0/02** - Comércio atacadista de produtos de higiene, limpeza e conservação domiciliar
  - **4646-0/01** - Comércio atacadista de cosméticos e produtos de perfumaria
  - **4644-3/02** - Comércio atacadista de medicamentos e drogas de uso veterinário
  - **4669-9/99** - Comércio atacadista de outras máquinas e equipamentos não especificados anteriormente
  - **4712-1/00** - Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios
  - **4789-0/02** - Comércio varejista de plantas e flores naturais
  - **0151-2/01** - Criação de bovinos para reprodução
  - **0153-9/01** - Criação de suínos
  - **0155-5/01** - Criação de frangos para corte
  - **0155-5/02** - Produção de ovos
  - **1099-6/99** - Fabricação de outros produtos alimentícios não especificados anteriormente
  - **2123-8/00** - Fabricação de preparações farmacêuticas
  - **4930-2/02** - Transporte rodoviário de produtos em geral, municipal
  - **8411-6/00** - Administração pública em geral
  - **9430-8/00** - Atividades de associações de defesa de direitos sociais
  - **8599-6/99** - Outras atividades de ensino não especificadas anteriormente
  - **8640-2/02** - Laboratórios clínicos
- **Alerta em Amarelo para o Administrador**: Se o CNAE extraído do cliente for diferente dos homologados, o sistema exibe um aviso em destaque amarelo no card do cliente e no modal de detalhes: **"Cliente com CNAE fora do permitido, analisar"**, exibindo o código e descrição exata do CNAE para tomada de decisão pela gerência.

### 7. 💳 Regras de Concessão de Limite de Crédito Automático
- Ao submeter um novo cadastro, o sistema avalia o retorno da auditoria de bureau (CENPROT / Direct Data / Cartórios de Protesto):
  - **Pessoa Jurídica (PJ) sem protestos** (`total_protestos === 0`): Limite de Crédito inicial concedido de **R$ 3.000,00**.
  - **Pessoa Física (PF) sem protestos** (`total_protestos === 0`): Limite de Crédito inicial concedido de **R$ 1.500,00**.
- O limite de crédito é de uso estritamente interno: **não é exibido para o cliente**, sendo visualizado e editado exclusivamente pela equipe no **Painel Administrativo** (`ClientDetailModal`) e enviado no payload do webhook para o ERP Moinho.

### 7. 🔍 Auditoria Automatizada & Bureau de Conformidade (Direct Data & Infosimples)
- Integrado na esteira de análise de crédito e validação documental com a API da **Direct Data** e **Infosimples**:
  - **CFMV / CRMV (Pessoa Física - `/cfmv/cadastro`)**: Consulta e validação em tempo real da situação cadastral do CRMV do profissional (Médico Veterinário) junto ao Conselho Federal de Medicina Veterinária via Infosimples. Garante que o cadastro só seja concluído se o registro profissional estiver constando como **Ativo / Regular**, bloqueando situações suspensas ou canceladas com alerta orientador.
  - **Receita Federal / Cartão CNPJ & QSA**: Extração oficial do Cartão CNPJ com Quadro Societário (QSA) via Infosimples / BrasilAPI e Ficha Cadastral PJ Plus (`CadastroPessoaJuridicaPlus`), anexando o documento oficial comprobatório ao cadastro do cliente que concluiu o credenciamento com sucesso.
  - **SINTEGRA / Cadastros Estaduais (`/api/Sintegra`)**: Consulta automática da Inscrição Estadual (IE) e verificação de situação cadastral (Habilitado/Ativo) no SEFAZ com comprovante oficial em PDF anexado automaticamente.
  - **CENPROT / IEPTB (`/api/ProtestosOnline`)**: Verificação unificada de ocorrências de protestos em cartórios em âmbito nacional.
- **Proxy Seguro Serverless**: Funções `api/directd.js` e `api/infosimples.js` para garantir execução rápida e segura no Vercel sem bloqueios de CORS ou WAF.

---

## 🔐 Variáveis de Ambiente (`.env`)

```env
# Conexão Supabase
VITE_SUPABASE_URL=https://sua-instancia.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# API Infosimples (Bureau)
VITE_INFOSIMPLES_TOKEN=seu-token-infosimples

# Credenciais Gov.br para JUCESP
VITE_JUCESP_LOGIN_CPF=41152588885
VITE_JUCESP_LOGIN_SENHA=@13setCaio
```

---

## ✉️ Configuração dos Templates de E-mail no Supabase

Para utilizar os templates com as cores e visual profissional da Vetline:

1. No Supabase Dashboard, acesse **Authentication > Email Templates**;
2. Na aba **Confirm signup** (Confirmação de cadastro):
   - Assunto: `Ative seu cadastro - Vetline Distribuidora`
   - Cole o conteúdo do arquivo [`supabase/templates/confirm_signup.html`](file:///supabase/templates/confirm_signup.html);
3. Na aba **Reset password** (Redefinição de senha):
   - Assunto: `Recuperação de Senha - Vetline Distribuidora`
   - Cole o conteúdo do arquivo [`supabase/templates/reset_password.html`](file:///supabase/templates/reset_password.html);
4. Em **Authentication > URL Configuration > Redirect URLs**, certifique-se de adicionar a URL do seu site (ex: `http://localhost:5173/` e a URL de produção na Vercel).

---

## 🗄️ Execução do Script SQL no Supabase (Schema `novo_cliente`)

O sistema foi desenhado para operar **exclusivamente no schema `novo_cliente`** (tabela `novo_cliente.data_new_client`), sem salvar dados de clientes no schema `public`.

Para garantir o funcionamento completo no seu Supabase:

1. Acesse seu painel no [Supabase](https://supabase.com);
2. Clique em **SQL Editor** no menu lateral esquerdo;
3. Abra ou copie o conteúdo do arquivo [`supabase/schema.sql`](file:///supabase/schema.sql) e [`supabase/add_bureau_columns.sql`](file:///supabase/add_bureau_columns.sql);
4. Clique no botão verde **Run** (Executar).

> 💡 **Dica (Opcional)**: Caso queira expor o schema `novo_cliente` diretamente para consultas REST além das funções RPC, acesse no Supabase: **Project Settings > API > Data API Settings > "Exposed schemas"** e adicione `novo_cliente`.

---

## 🔐 Acessos e Rotas

- **Área do Cliente & Cadastro**: `http://localhost:5173/` (ou rota principal em produção).
- **Painel Administrativo**: `http://localhost:5173/admin` (ou clique em *Acesso Administrativo* no rodapé).

