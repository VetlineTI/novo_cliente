# 🐾 Vetline - Formulário de Cadastro de Clientes & Painel Administrativo

Aplicação web moderna, intuitiva e altamente responsiva para cadastro e credenciamento de novos clientes (Pessoa Física e Pessoa Jurídica) da **Vetline Distribuidora de Produtos Veterinários**, integrada com **React**, **Tailwind CSS** e banco de dados **Supabase** no schema **`novo_cliente`** (tabelas `data_new_client` e `admin_profiles`).

---

## 📸 Funcionalidades e Regras de Negócio

1. **Tipo de Pessoa (Primeiro Campo Obrigatório)**:
   - Seleção inicial e mandatória entre **Pessoa Jurídica (PJ)** ou **Pessoa Física (PF)**.
   - O formulário adapta campos, máscaras e documentos exigidos automaticamente com base no tipo selecionado.

2. **Pessoa Jurídica (com Integração BrasilAPI)**:
   - **CNPJ** com máscara (`00.000.000/0000-00`) e validação matemática real (Módulo 11).
   - **Consulta em Tempo Real na Receita Federal (BrasilAPI)**: Ao digitar o CNPJ, busca automaticamente a **Razão Social**, situação cadastral (**ATIVA**, **BAIXADA**), sugestão de segmento pelo CNAE e o **Quadro de Sócios (QSA)**.
   - **Documentos PJ**:
     - *Contrato Social / Documento Constitutivo*
     - *Documento com Foto de um dos Sócios (RG/CNH)*
     - **Regra**: Obrigatório anexar **pelo menos 1** documento (Contrato Social OU Documento com Foto do Sócio).

3. **Pessoa Física**:
   - **CPF** com máscara (`000.000.000-00`) e validação matemática de dígitos verificadores.
   - **Nome Completo**.
   - **Documentos PF**:
     - *CRMV (Carteira Profissional do Médico Veterinário)*
     - *Comprovante de Endereço (recente)*
     - **Regra**: **Ambos os 2 documentos são obrigatórios**.

4. **Contato e Segmento**:
   - **Telefone / WhatsApp** com máscara `(00) 00000-0000` e ícone oficial do WhatsApp.
   - **Segmento de Atuação** (29 opções padronizadas de mercado).
   - **E-mail** com validação de formato.

5. **Atendimento por Vendedor (`cd_vend`) e Dados Comerciais (`tab_pre`, `tp_ped`)**:
   - Pergunta mandatória: *"Foi atendido por algum vendedor?"*
   - Se **Não**: Salva automaticamente o código `'ATENA'` na coluna `cd_vend` da tabela `data_new_client`.
   - Se **Sim**: Permite pesquisar e selecionar os vendedores cadastrados na tabela `public.vendedor` pelo código (`cd_vend`) ou pelo nome (`nome_vendedor`).
   - **Tabela de Preço (`tab_pre`) & Tipo de Pedido (`tp_ped`)**: Preenchidos automaticamente com o valor padrão `'VTL01'` no envio do cliente, ficando disponíveis para consulta e edição no painel administrativo.

6. **Endereço de Entrega Alternativo**:
   - Campo/Toggle condicional: *"Endereço de entrega diferente do comprovante de endereço anexado?"*
   - Se **Sim**, abre os campos com busca automática por CEP através da API do **ViaCEP** (preenchendo Rua, Bairro, Cidade e Estado automaticamente).

7. **Upload de Documentos no Bucket `novos_clientes` com Pastas por CNPJ/CPF**:
   - Componente moderno com suporte a Drag & Drop, validação de extensão (`.pdf`, `.jpg`, `.jpeg`, `.png`), limite de 5MB por arquivo e pré-visualização.
   - **Estrutura no Supabase Storage**: Utiliza o bucket principal **`novos_clientes`** e cria automaticamente uma subpasta com o **CNPJ ou CPF** do cliente (ex: `novos_clientes/12345678000190/` ou `novos_clientes/12345678900/`), distribuindo os arquivos nas pastas correspondentes (`documento_identificacao`, `comprovante_endereco`, `contrato_social`, `inscricao_estadual`).

8. **Termos e Feedback**:
   - Box informativo sobre entrega em endereço diferente.
   - Modal com os Termos e Condições de Entrega completos.
   - Checkbox obrigatório de concordância.
   - Modal de comemoração com confetes, número de protocolo e botão único "OK".

9. **Painel Administrativo com Login, Edição Completa e Gestão (/admin)**:
   - Acesso restrito via **Supabase Auth** (`auth.users`) ou credenciais de emergência.
   - Visão padrão focada nas solicitações com status **Pendente**.
   - Contadores em tempo real de status (**Pendentes**, **Em Análise**, **Aprovados**, **Recusados**).
   - Busca instantânea e filtros por Tipo de Pessoa (PJ / PF) e Status.
   - **Edição Cadastral & Comercial Completa**:
     - O administrador pode editar qualquer dado preenchido pelo cliente (Razão Social/Nome, Documento, Segmento, Telefone, E-mail, IE, Endereço de entrega).
     - Edição direta dos dados comerciais: **Tabela de Preço (`tab_pre`)**, **Tipo de Pedido (`tp_ped`)** e **Vendedor Responsável (`cd_vend`)**.
     - Ao salvar ou clicar em "Aprovar Cadastro" / "Recusar" / "Em Análise", todas as alterações são salvas e persistidas diretamente no banco de dados Supabase.
   - **Organização por Pastas de Documentos**:
     - 📁 *Pasta de Identificação Pessoal* (RG, CNH, CIN, CRMV).
     - 📁 *Pasta de Comprovante de Endereço* (Residencial ou da Empresa).
     - 📁 *Pasta de Documentos da Empresa* (Contrato Social, Cartão CNPJ e Inscrição Estadual).
     - 📁 *Pasta Ficha Cadastral & Dados Comerciais* (Dados completos, `tab_pre`, `tp_ped`, `cd_vend` e endereço).
   - **Visualizador Integrado de Documentos**: Suporte a zoom, rotação, tela cheia e download direto de imagens e PDFs.

10. **Gestão de Usuários do Supabase Auth e Regras de Perfis**:
   - Busca e lista todos os usuários cadastrados no `auth.users` do Supabase via RPC `list_auth_users_with_profiles`.
   - **Regras de Perfil**:
     - 👑 **Administrador (ADM)**: Acesso total, aprova/recusa cadastros e gerencia permissões de usuários.
     - 👤 **Operador**: Visualização, análise de documentos e pareceres internos.
     - 👁️ **Consulta**: Apenas visualização.
     - 🚫 **Bloqueado / Sem Acesso**: Usuário existente no `auth.users` sem autorização para logar no painel.
   - **Concessão de Perfil em 1 Clique**: O administrador pode selecionar qualquer usuário da lista ou informar o e-mail e conceder perfil ADM imediatamente.

---

## 📂 Estrutura de Arquivos

| Arquivo / Diretório | Descrição |
| :--- | :--- |
| `index.html` | Estrutura HTML principal com fontes do Google Fonts (*Plus Jakarta Sans* e *Inter*) e metatags. |
| `package.json` | Dependências do projeto (React, Lucide React, Supabase JS, Canvas Confetti, Tailwind CSS). |
| `vite.config.js` | Configuração de build e desenvolvimento do Vite (com `server.host: true` para rede local). |
| `tailwind.config.js` | Configuração do Tailwind CSS com a paleta de cores institucional da Vetline. |
| `postcss.config.js` | Plugins PostCSS para processamento do Tailwind. |
| `.env.example` | Modelo das variáveis de ambiente necessárias para conexão com o Supabase. |
| `.env` | Arquivo de variáveis de ambiente locais com chaves do projeto. |
| `public/vetline-logo.png` | Imagem oficial do logotipo da Vetline para favicon e acesso público. |
| `src/assets/vetline-logo.png` | Imagem do logotipo da Vetline importada no cabeçalho. |
| `README.md` | Documentação completa do projeto, estrutura e instruções de uso. |
| `supabase/schema.sql` | Script SQL completo com schema `novo_cliente`, tabelas `data_new_client` e `admin_profiles`, RPCs `list_auth_users_with_profiles` e `set_user_role`, Storage e RLS. |
| `src/main.jsx` | Ponto de entrada da aplicação React. |
| `src/App.jsx` | Componente raiz com roteamento entre Portal do Cliente (`/`) e Painel Administrativo (`/admin`). |
| `src/index.css` | Estilização global com Tailwind CSS, animações e scrollbar personalizada. |
| `src/lib/supabase.js` | Conexão com Supabase no schema `novo_cliente`, upload no bucket `novos_clientes`, busca de clientes e atualização de status. |
| `src/lib/adminAuth.js` | Módulo de autenticação com Supabase Auth, controle de sessão, busca de usuários via RPC e regras de perfis. |
| `src/components/Header.jsx` | Cabeçalho com logo Vetline, selo de segurança SSL, botão de atendimento e acesso rápido ao Admin. |
| `src/components/LeftSidebar.jsx` | Painel lateral com título "Seja um cliente Vetline" e lista de benefícios com ícones. |
| `src/components/RegistrationForm.jsx` | Formulário reativo principal com todas as regras de negócio e validações. |
| `src/components/CameraCaptureModal.jsx` | Modal de captura de foto em tempo real pela câmera do celular/computador com enquadramento. |
| `src/components/DocumentUpload.jsx` | Componente de upload de arquivos e fotos com suporte a câmera, drag & drop e feedback de validação. |
| `src/components/TermsModal.jsx` | Modal com os termos e regras de entrega e conformidade. |
| `src/components/SuccessModal.jsx` | Modal de confirmação do envio com confetes, protocolo e botão único OK. |
| `src/components/admin/AdminLogin.jsx` | Tela de login administrativo integrado com Supabase Auth e credenciais de emergência. |
| `src/components/admin/AdminDashboard.jsx` | Painel de controle com abas de Cadastros de Clientes e Gestão de Usuários & Perfis. |
| `src/components/admin/UserManagementView.jsx` | Módulo de listagem de usuários do `auth.users`, regras de perfil e concessão de perfil ADM em 1 clique. |
| `src/components/admin/ClientDetailModal.jsx` | Visualização detalhada do cliente organizada em **Pastas de Documentos** e ações de aprovação. |
| `src/components/admin/DocumentViewerModal.jsx` | Visualizador de alta resolução para documentos (zoom, rotação, PDF/imagens e download). |
| `src/utils/masks.js` | Funções para aplicação de máscaras (CPF, CNPJ, Telefone, CEP e tamanho de arquivo). |
| `src/utils/validators.js` | Algoritmos de validação de CPF, CNPJ, e-mail e consulta na API ViaCEP. |
| `src/utils/documentValidator.js` | Validador inteligente de documentos com OCR (Tesseract.js), leitura de QR Code (jsQR) e leitura de PDFs (pdfjs-dist). |

---

## 🗄️ Execução do Script SQL no Supabase

Para ativar o schema, a tabela de clientes, o controle de perfis administrativos e a busca de usuários de `auth.users`:

1. Acesse seu painel no [Supabase](https://supabase.com);
2. Clique em **SQL Editor** no menu lateral esquerdo;
3. Abra ou copie o conteúdo do arquivo [`supabase/schema.sql`](file:///supabase/schema.sql);
4. Clique no botão verde **Run** (Executar);
5. O script irá:
   - Criar o schema `novo_cliente` e a tabela `data_new_client`;
   - Criar a tabela `admin_profiles` para armazenar os perfis dos usuários;
   - Criar a função `novo_cliente.list_auth_users_with_profiles()` para listar os usuários do `auth.users`;
   - Criar a função `novo_cliente.set_user_role()` para conceder perfil ADM por ID ou e-mail;
   - Configurar o bucket `novos_clientes` no Supabase Storage;
   - Sincronizar todos os usuários já existentes no `auth.users` com perfil de **Administrador**.

---

## 🔐 Acesso e Concessão de Perfil de Administrador

1. Acesse `http://localhost:5173/admin`;
2. Faça login com seu e-mail e senha cadastrados no Supabase Auth (ou com `admin@vetline.com.br` / `admin`);
3. No painel, clique na aba **"Usuários & Perfis"** no topo;
4. Você verá a lista de todos os usuários cadastrados no `auth.users` do Supabase;
5. Para alterar permissões ou tornar um usuário Administrador:
   - Clique no botão verde **"Dar Perfil ADM"** diretamente na linha do usuário na tabela;
   - Ou utilize o seletor de permissão (Administrador, Operador, Consulta ou Bloqueado) na própria linha.
