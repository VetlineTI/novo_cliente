# 📋 Resumo da Validação de Dados e Documentos - Vetline

Como o sistema valida cada informação no momento do cadastro de forma automática, gratuita e instantânea:

---

### 🏢 1. Validação de CNPJ (Pessoa Jurídica)
1. **Dígitos Verificadores**: Bloqueia números falsos ou inventados pelo cálculo oficial (Módulo 11).
2. **Receita Federal em Tempo Real (BrasilAPI)**:
   - ✅ Confere se a empresa está **ATIVA** (alerta se estiver baixada ou inapta);
   - ✍️ Preenche a **Razão Social** e sugere o **Segmento** automaticamente;
   - 👥 Puxa a lista de **Sócios (donos)** da empresa para cruzar com o documento anexado.

---

### 👤 2. Validação de CPF (Pessoa Física)
1. **Dígitos Verificadores**: Bloqueia CPFs matematicamente inválidos ou repetidos.
2. **Conferência com o Documento**: Confere se o CPF digitado é o mesmo impresso no documento anexado.

---

### 🪪 3. Validação de Documentos (RG e CNH)
Aceita **PDF (CNH Digital)**, **foto da galeria** ou **foto tirada na hora pela câmera**:

* **🟢 Com QR Code (CNH pós-2017 e Nova Identidade CIN)**:
  - O sistema lê o QR Code oficial do Governo Federal;
  - Extrai a assinatura digital e o CPF criptografado;
  - **Resultado**: `⚡ QR Code Oficial Verificado`.

* **🔵 Sem QR Code (RG tradicional de papel de qualquer Estado)**:
  - **Passo A**: A IA lê o texto e busca carimbos oficiais (*"República"*, *"SSP"*, *"Registro Geral"*). Rejeita memes ou fotos aleatórias;
  - **Passo B**: Confere se o CPF e o Nome impressos batem com o cadastro;
  - **Passo C (Para PJ)**: Confere se a pessoa é **sócia oficial do CNPJ** da empresa;
  - **Resultado**: `✅ Documento e CPF Conferidos` ou `👥 Sócio Confirmado no CNPJ`.

---

### 📊 Tabela Resumo

| O que foi enviado | Como é validado | Selo Retornado |
| :--- | :--- | :--- |
| **CNPJ** | Cálculo matemático + Consulta na Receita Federal (BrasilAPI) | ✅ **CNPJ ATIVO na Receita** |
| **CPF** | Cálculo oficial + Comparação com a foto | ✅ **CPF Válido** |
| **CNH com QR Code** | Leitura da assinatura digital criptografada do Governo | ⚡ **QR Code Oficial Verificado** |
| **RG de papel nítido** | IA lê carimbos da SSP + confere CPF e Nome | ✅ **Documento e CPF Conferidos** |
| **Documento de Sócio** | IA lê o nome e cruza com os donos do CNPJ na Receita | 👥 **Sócio Confirmado no CNPJ** |
| **Foto inválida / escura** | IA detecta ausência de termos de documento oficial | ⚠️ **Atenção na Legibilidade** |
