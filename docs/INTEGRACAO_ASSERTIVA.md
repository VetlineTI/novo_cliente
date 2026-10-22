# 📑 Especificação Técnica & Guia de Integração - API Assertiva Soluções (Análise 360 / Score)

Este documento registra a análise técnica completa, arquitetura de autenticação, endpoints e plano de migração da **DirectData** para a **Assertiva Soluções** no sistema de cadastro e auditoria de clientes da **Vetline**.

---

## 🎯 Objetivo da Migração
Substituir as consultas restritivas e de bureau da **DirectData** (que atualmente apresentam instabilidade/saldo insuficiente) pela suíte **Assertiva Análise 360 / Score**, agregando:
1. **Score de Crédito** (0 a 1000) e **Classificação de Risco** (A a F);
2. **Protestos em Cartório Nacional** (CENPROT / IEPTB com valor, datas e cartórios);
3. **Ações Judiciais e Processos de Execução** (cíveis e executivos);
4. **Faturamento Presumido** (PJ) e **Renda Presumida** (PF);
5. **Geração de Dossiê Digital / PDF de Crédito** para a equipe financeira aprovar limite de crédito e prazo.

> **Importante:** A validação de **CRMV / CFMV** de Médicos Veterinários continua sendo feita via **InfoSimples** (`/cfmv/cadastro`), pois a Assertiva não atende conselhos de classe. A validação do **QSA** (Quadro de Sócios para conferir CNH/RG do administrador) é atendida nativamente pela consulta de CNPJ da Receita Federal (InfoSimples / BrasilAPI).

---

## 🔐 1. Arquitetura de Autenticação (OAuth 2.0)

A Assertiva utiliza **OAuth 2.0** com fluxo `client_credentials` e autenticação inicial via **HTTP Basic Auth**.

### 1.1 Endpoint de Emissão de Token
* **Método:** `POST`
* **URL:** `https://api.assertivasolucoes.com.br/oauth2/v3/token`
* **Headers:**
  * `Authorization`: `Basic {base64(CLIENT_ID:CLIENT_SECRET)}`
  * `Content-Type`: `application/x-www-form-urlencoded`
* **Body:**
  * `grant_type=client_credentials`

### 1.2 Resposta (200 OK)
```json
{
  "access_token": "8e3b7892-5fbc-4564-942d-531107f4667a",
  "token_type": "bearer",
  "expires_in": 60,
  "scope": "ALL"
}
```

### 1.3 Estratégia de Cache e Renovação
- O `access_token` tem validade curta (`expires_in`, tipicamente 60 segundos).
- **Regra de Implementação:** O backend/proxy armazena o token em cache com timestamp de expiração. Novas requisições utilizam o token em memória. Caso falte menos de 10 segundos para expirar, o serviço solicita um novo token automaticamente.
- **Segurança:** As chaves `ASSERTIVA_CLIENT_ID` e `ASSERTIVA_CLIENT_SECRET` devem ficar protegidas nas variáveis de ambiente do servidor (`.env`), nunca expostas no frontend do navegador.

---

## 📡 2. Endpoints Homologados para Uso

### 2.1 Score de Crédito e Restrições PJ (Principal)
* **Endpoint:** `GET https://api.assertivasolucoes.com.br/score/v3/pj/credito/{cnpj}?acoes=true&idFinalidade=2`
* **Headers:** `Authorization: Bearer {access_token}`
* **Parâmetros:**
  * `cnpj`: 14 dígitos (apenas números);
  * `acoes=true`: Inclui o histórico de ações judiciais e execuções no mesmo chamado;
  * `idFinalidade=2`: Exigência de conformidade LGPD (2 = Ciclo de Crédito).
* **Dados Retornados:**
  * `resposta.score`: Classe (`A` a `F`), faixa de risco, pontuação (`0` a `1000`) e probabilidade de honrar compromissos nos próximos 6 meses;
  * `resposta.protestosPublicos`: Total de protestos, valor total em R$, última ocorrência e lista com Cartório, Cidade, UF, Data e Valor;
  * `resposta.faturamentoEstimado`: Valor estimado do faturamento anual;
  * `resposta.acoes`: Lista de ações executivas com vara, fórum, comarca, tipo e valor da causa;
  * `resposta.ultimasConsultas`: Quantidade e consultantes no mercado (birôs, bancos);
  * `resposta.cheques`: Ocorrências de cheques sem fundos.

### 2.2 Ações Judiciais PJ (Consulta Isolada Opcional)
* **Endpoint:** `GET https://api.assertivasolucoes.com.br/score/v3/pj/acoes/{cnpj}?idFinalidade=2`

### 2.3 Score de Recuperação PJ (Cobrança)
* **Endpoint:** `GET https://api.assertivasolucoes.com.br/score/v3/pj/recupere/{cnpj}?idFinalidade=2`
* **Utilidade:** Avalia probabilidade de quitação de acordos em caso de inadimplência.

### 2.4 Score de Crédito e Restrições PF (Médicos Veterinários / Pessoas Físicas)
* **Endpoint:** `GET https://api.assertivasolucoes.com.br/score/v3/pf/credito/{cpf}?acoes=true&positivo=true&idFinalidade=2`
* **Dados Retornados:**
  * Score do CPF (0-1000, faixas A a F);
  * Protestos públicos no CPF;
  * Renda presumida;
  * Ações judiciais no CPF;
  * Indicadores do Cadastro Positivo (pontualidade, comprometimento de renda).

---

## 📄 3. Geração do Dossiê Cadastral & Crédito (PDF / HTML)

Como os endpoints da Assertiva retornam dados analíticos JSON, o sistema implementará um gerador padronizado (nos mesmos moldes do `generateReceitaPJParticipacaoSocietariaHtml` e `generateProtestosDirectDHtml`):

1. **Função:** `generateAssertivaDossieHtml(dadosCliente, dadosAssertiva)`
2. **Conteúdo do Documento:**
   - **Cabeçalho:** Logotipo oficial da Vetline + Carimbo com Protocolo Assertiva e Data/Hora da consulta;
   - **Identificação Cadastral:** CNPJ/CPF, Razão Social / Nome, CNAE, Endereço;
   - **Termômetro de Risco & Score:** Pontuação visual (0 a 1000), Badge da Classe (A a F) e parecer de propensão a pagamento;
   - **Quadro de Protestos:** Quantidade, valor acumulado e tabela discriminada de cartórios;
   - **Quadro de Ações Judiciais:** Processos executivos, comarcas e valores;
   - **Faturamento Presumido & Capacidade Financeira**;
   - **Autenticação:** Código UID da consulta para auditoria do compliance.
3. **Armazenamento:** Salvo no Supabase Storage (`novos_clientes`) e vinculado à coluna `doc_cenprot_url` / `doc_assertiva_url` do cliente.

---

## 🛠️ 4. Roteiro Passo a Passo para a Migração Futura

Quando recebermos as credenciais de produção da Assertiva:

1. **Variáveis de Ambiente (`.env`):**
   ```env
   ASSERTIVA_CLIENT_ID=seu_client_id_aqui
   ASSERTIVA_SECRET=seu_client_secret_aqui
   ```
2. **Criar Proxy Serverless (`api/assertiva.js`):**
   - Gerencia o token OAuth2 com cache automático;
   - Encaminha chamadas `/api-assertiva/score/v3/...` evitando bloqueios de CORS no frontend.
3. **Configurar Vite (`vite.config.js`) e Vercel (`vercel.json`):**
   - Adicionar o proxy local `/api-assertiva` apontando para `https://api.assertivasolucoes.com.br/`.
4. **Criar Módulo Cliente (`src/lib/assertiva.js`):**
   - Funções: `consultarAssertivaPJ(cnpj)`, `consultarAssertivaPF(cpf)` e `generateAssertivaDossieHtml()`.
5. **Atualizar `executarAuditoriaBureau` (`src/lib/infosimples.js`):**
   - Substituir as chamadas da DirectData para JUCESP/Protestos pela consulta integrada da Assertiva.
6. **Atualizar Painel Admin (`ClientDetailModal.jsx`):**
   - Exibir o Badge do Score de Crédito (ex: `Score 820 • Risco Baixo (Classe A)`);
   - Botão para visualizar/baixar o Dossiê Completo de Crédito.
