# 🐾 Vetline - Portal de Credenciamento, Área do Cliente & Painel Administrativo

Aplicação web moderna, intuitiva e altamente responsiva para credenciamento, login, autoatendimento e gestão de clientes (Pessoa Física e Pessoa Jurídica) da **Vetline Distribuidora de Produtos Veterinários**, integrada com **React**, **Tailwind CSS** e banco de dados **Supabase** no schema **`novo_cliente`** (tabelas `data_new_client`, `admin_profiles` e integração com `auth.users`).

---

## 📸 Funcionalidades e Regras de Negócio

### 1. 🔑 Tela Inicial com Abas ("Já sou cliente" & "Ainda não sou")
- A rota principal (`/`) oferece um seletor moderno de abas:
  - **Aba "Já sou cliente"**: Formulário de login direto com e-mail e senha cadastrados no Supabase Auth, permitindo acesso imediato à Área do Cliente.
  - **Aba "Ainda não sou"**: Formulário completo de credenciamento e apresentação institucional da Vetline.

### 2. 🛡️ Criação de Senha & Acesso Imediato à Área do Cliente
- Ao preencher o formulário e clicar em **"Enviar cadastro"**, o sistema abre o modal **"Acesso à Área do Cliente"** (`CreatePasswordModal`).
- O usuário confirma o **e-mail para login** e define sua **senha de acesso**.
- O sistema registra o cliente no **Supabase Auth (`auth.users`)** com ativação direta e salva os dados cadastrais na tabela `novo_cliente.data_new_client`.
- **Acesso Imediato (Sem bloqueio de e-mail)**: O cliente é liberado imediatamente sem dependência de link de confirmação por e-mail, evitando limites de envio (rate limits) de provedores de e-mail.
- **Login Rápido**: O cliente pode acessar a Área do Cliente a qualquer momento na aba **"Já sou cliente"** informando seu e-mail e senha cadastrados.

### 3. 👤 Portal & Área do Cliente (`ClientDashboard`)
- Painel exclusivo para o cliente autenticado acompanhar e gerenciar seu cadastro:
  - **Acompanhamento de Status em Tempo Real**:
    - 🟡 **Pendente**: Cadastro em fila com informações de prazo de análise.
    - 🔵 **Em Análise**: Processo de checagem documental ativo.
    - 🟢 **Aprovado**: Boas-vindas com exibição das condições comerciais, tabela de preço liberada (`VTL01`) e vendedor responsável.
    - 🔴 **Necessita Correções (Recusado)**: Exibição clara das notas/parecer do analista para que o cliente ajuste os dados e reenviar documentos.
  - **Edição de Dados Cadastrais**:
    - Alteração de Razão Social/Nome, telefone/WhatsApp, e-mail de faturamento, segmento e endereços (principal e entrega divergente com busca por CEP).
  - **Documentos & Reenvio de Anexos**:
    - Visualização dos arquivos já enviados com suporte a zoom e rotação.
    - Botão **"Substituir / Enviar documento"** para reenvio direto de arquivos ao Supabase Storage.
  - **Atendimento e Suporte**: Canal direto via WhatsApp integrado com os dados do cliente.

### 4. 🏢 Regras Cadastrais (PF & PJ)
- **Tipo de Pessoa**: Seleção entre Pessoa Jurídica (PJ) e Pessoa Física (PF).
- **Pessoa Jurídica (PJ)**: Consulta automática na Receita Federal via BrasilAPI ao digitar o CNPJ, preenchendo Razão Social, CNAE, Situação Cadastral e Sócios. Anexo de Contrato Social OU Documento do Sócio (pelo menos 1 obrigatório).
- **Pessoa Física (PF)**: Validação de CPF e obrigatoriedade de CRMV (Médico Veterinário) + Comprovante de Endereço.
- **Endereço Principal & Entrega**: Preenchimento automático via CEP (BrasilAPI / ViaCEP).
- **Vendedor Responsável (`cd_vend`)**: Seleção de vendedor da tabela `public.vendedor` ou padrão `'ATENA'`.

### 5. 👑 Painel Administrativo (`/admin`)
- Rota dedicada para administradores e analistas de cadastro da Vetline.
- Contadores de status, filtros rápidos por PJ/PF e busca textual inteligente.
- Edição cadastral e comercial completa (`tab_pre`, `tp_ped`, `cd_vend`, status e parecer interno `notes`).
- Organização em **Pastas de Documentos** e visualizador integrado de PDFs e imagens.
- **Gestão de Usuários & Perfis**: Listagem dos usuários de `auth.users` via RPC e concessão de perfis (Administrador, Operador, Consulta ou Bloqueado).

---

## 📂 Estrutura de Arquivos

| Arquivo / Diretório | Descrição |
| :--- | :--- |
| `index.html` | Estrutura HTML principal com fontes do Google Fonts (*Plus Jakarta Sans* e *Inter*) e metatags. |
| `package.json` | Dependências do projeto (React, Lucide React, Supabase JS, Canvas Confetti, Tailwind CSS). |
| `vite.config.js` | Configuração de build e desenvolvimento do Vite. |
| `vercel.json` | Configuração de rewrites para suporte a SPA e rotas diretas na Vercel. |
| `supabase/schema.sql` | Script SQL completo com schema `novo_cliente`, `data_new_cliente` (colunas em Português BR), `admin_profiles`, `auth_user_id`, RPCs de usuários e Storage. |
| `supabase/rename_columns_to_ptbr.sql` | Script de migração para renomear todas as colunas da tabela de clientes para Português BR no Supabase. |
| `supabase/fix_auth_trigger.sql` | Correção definitiva do trigger `handle_new_auth_user()` e criação de view de compatibilidade para evitar erro 500 no cadastro. |
| `supabase/add_bureau_columns.sql` | Script SQL para adicionar as colunas do Bureau e Certidões (JUCESP, CENPROT e Receita Federal) no Supabase. |
| `supabase/migrate_from_public.sql` | Script de migração segura de dados de `public.data_new_client` para `novo_cliente.data_new_cliente`. |
| `supabase/templates/confirm_signup.html` | Template HTML profissional e responsivo para e-mail de ativação de cadastro com cores da Vetline e logo oficial. |
| `supabase/templates/reset_password.html` | Template HTML profissional para e-mail de recuperação de senha com identidade visual Vetline. |
| `api/infosimples.js` | Serverless Function para Vercel: Proxy seguro para consultas à API Infosimples (evita 403 e CORS). |
| `api/directd.js` | Serverless Function para Vercel: Proxy seguro para consultas à API Direct Data (evita CORS). |
| `src/main.jsx` | Ponto de entrada da aplicação React. |
| `src/App.jsx` | Roteamento dinâmico entre Portal do Cliente (`/`), Área do Cliente Logado e Painel Administrativo (`/admin`). |
| `src/lib/supabase.js` | Conexão com Supabase no schema `novo_cliente`, upload no bucket `novos_clientes`, persistência e atualização de cadastros. |
| `src/lib/clientAuth.js` | Módulo de autenticação do cliente (Supabase Auth, ativação por e-mail, login, atualização cadastral e reenvio de anexos). |
| `src/lib/adminAuth.js` | Módulo de autenticação com Supabase Auth para a equipe administrativa e gestão de perfis. |
| `src/lib/infosimples.js` | Módulo de integração com APIs de bureau (JUCESP Ficha Simplificada, CENPROT Protestos e SINTEGRA). |
| `src/lib/directd.js` | Módulo de integração com a API Direct Data: `CadastroPessoaJuridicaPlus`, `ProtestosOnline` (IEPTB / CENPROT Nacional) e `Sintegra` (Consulta e validação cadastral estadual com comprovante em PDF). |
| `src/components/Header.jsx` | Cabeçalho com logo Vetline, indicador de segurança, identificação da sessão do cliente e link para Admin. |
| `src/components/LeftSidebar.jsx` | Painel lateral de benefícios institucionais da Vetline. |
| `src/components/RegistrationForm.jsx` | Formulário reativo de credenciamento com validações de negócio, checagem antecipada de Sócios (QSA) e Sintegra, e acionamento de criação de senha. |
| `src/components/CreatePasswordModal.jsx` | Modal de definição de senha do cliente com validações e aviso de ativação por e-mail. |
| `src/components/SuccessModal.jsx` | Modal de confirmação com orientações de verificação do e-mail de ativação e botão para ir ao login. |
| `src/components/TermsModal.jsx` | Modal com termos e regras de entrega e conformidade. |
| `src/components/PartnerMismatchModal.jsx` | Modal de alerta de divergência cadastral e societária (QSA / SINTEGRA) com motivos de não aprovação e botão de ação. |
| `src/components/SegmentHelpModal.jsx` | Modal com guia descritivo e tabela de identificação de todos os segmentos de atuação. |
| `src/components/DocumentUpload.jsx` | Componente de upload de documentos com drag & drop e câmera integrada. |
| `src/components/client/ClientPortalAuth.jsx` | Tela principal com as abas **"Já sou cliente"** e **"Ainda não sou"**. |
| `src/components/client/ClientLogin.jsx` | Formulário de login do cliente com banner de ativação, tratamento de conta pendente e reenvio de e-mail. |
| `src/components/client/ForgotPasswordModal.jsx` | Modal de solicitação de recuperação de senha via envio de link para o e-mail cadastrado. |
| `src/components/client/ResetPasswordModal.jsx` | Modal de criação de nova senha para usuários que acessam o link de recuperação. |
| `src/components/client/ClientDashboard.jsx` | Painel do cliente logado com acompanhamento de status, edição de dados e reenvio de documentos. |
| `src/components/admin/AdminLogin.jsx` | Tela de login administrativo com Supabase Auth e credenciais de emergência. |
| `src/components/admin/AdminDashboard.jsx` | Painel de controle administrativo com listagem de clientes e gestão de perfis. |
| `src/components/admin/ClientDetailModal.jsx` | Visualização detalhada do cliente organizada em pastas e aprovações. |
| `src/components/admin/DocumentViewerModal.jsx` | Visualizador de alta resolução para documentos (zoom, rotação e download). |
| `src/components/admin/UserManagementView.jsx` | Módulo de listagem de usuários do `auth.users` e concessão de perfis. |
| `src/utils/masks.js` | Funções de máscara para CPF, CNPJ, Telefone, CEP e tamanhos de arquivo. |
| `src/utils/validators.js` | Algoritmos de validação de CPF, CNPJ, e-mail e consulta de CEP. |

### 6. 🔍 Auditoria Automatizada & Bureau de Conformidade (Direct Data & Infosimples)
- Integrado na esteira de análise de crédito e validação documental com a API da **Direct Data** e **Infosimples**:
  - **SINTEGRA / Cadastros Estaduais (`/api/Sintegra`)**: Consulta automática da Inscrição Estadual (IE) e verificação de situação cadastral (Habilitado/Ativo) no SEFAZ. O comprovante oficial em PDF (`urlComprovante`) é anexado automaticamente aos documentos do cliente para análise do administrador.
  - **JUCESP (Ficha Cadastral Simplificada)**: Consulta oficial na Junta Comercial via Direct Data / Gov.br, obtendo NIRE, capital, objeto social e comprovante em PDF oficial.
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

