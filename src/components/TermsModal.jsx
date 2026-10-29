import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  ShieldCheck,
  Cookie,
  CheckCircle,
  ExternalLink,
  Download,
  Info,
  Lock,
  Building2,
  Check
} from 'lucide-react';

export const TermsModal = ({
  isOpen,
  onClose,
  onAccept,
  initialTab = 'terms',
  showAcceptButton = true
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sincroniza a aba inicial sempre que o modal abre
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const pdfUrl = '/docs/termo_de_uso.pdf';

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-brand-green flex items-center justify-center flex-shrink-0 shadow-xs">
              {activeTab === 'terms' && <FileText className="w-5 h-5" />}
              {activeTab === 'lgpd' && <ShieldCheck className="w-5 h-5" />}
              {activeTab === 'cookies' && <Cookie className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                Políticas & Conformidade Legal
              </h2>
              <p className="text-xs text-slate-500">Vetline Distribuidora de Produtos Veterinários</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Abas de Navegação */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-6 gap-2 sm:gap-4 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'terms'
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Termos de Uso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lgpd')}
            className={`py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lgpd'
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacidade & LGPD</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cookies')}
            className={`py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cookies'
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cookie className="w-4 h-4" />
            <span>Política de Cookies</span>
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-600 leading-relaxed max-h-[60vh]">
          
          {/* ========================================================================= */}
          {/* ABA 1: TERMOS DE USO                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'terms' && (
            <div className="space-y-4 animate-fade-in">
              {/* Card de Download do PDF Oficial */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-brand-green flex items-center justify-center flex-shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                      Documento Oficial em PDF
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Consulte ou baixe a versão completa assinada e homologada da Vetline.
                    </p>
                  </div>
                </div>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Termo em PDF</span>
                </a>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">1</span>
                  Objetivo e Aceite do Credenciamento
                </h3>
                <p>
                  Estes Termos de Uso regulam o credenciamento de profissionais autônomos (Médicos Veterinários - PF) e estabelecimentos veterinários (PJ - Clínicas, Hospitais, Pet Shops e Agropecuárias) perante a <strong>Vetline Distribuidora de Produtos Veterinários</strong> para aquisição de produtos, faturamento e concessão de crédito comercial. Ao submeter este formulário, o titular declara a veracidade e autenticidade dos dados e documentos prestados.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">2</span>
                  Conformidade Sanitária, CFMV/CRMV e MAPA
                </h3>
                <p>
                  A comercialização de vacinas, antibióticos, produtos biológicos e medicamentos controlados está sujeita às normas técnicas do Ministério da Agricultura e Pecuária (MAPA) e do Conselho Federal de Medicina Veterinária (CFMV). A Vetline realiza conferência e validação da regularidade do registro profissional (CRMV) e do Responsável Técnico (RT), reservando-se o direito de recusar pedidos caso a documentação esteja suspensa, cancelada ou inconsistente.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">3</span>
                  Condições de Entrega e Logística Refrigerada
                </h3>
                <p>
                  A Vetline poderá realizar entregas em endereços operacionais distintos do domicílio fiscal (CNPJ/CPF), desde que informado e justificado formalmente neste cadastro e validado por nossa equipe de conformidade. Para medicamentos e vacinas que exigem cadeia de frio (2°C a 8°C), o cliente se compromete a disponibilizar pessoa autorizada e estrutura adequada de refrigeração no momento da recepção física da mercadoria.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">4</span>
                  Análise Comercial e Concessão de Crédito
                </h3>
                <p>
                  O envio do cadastro não garante concessão automática de limite de crédito ou faturamento a prazo. A Vetline reserva-se o direito de realizar consultas cadastrais em órgãos de proteção ao crédito, birôs e cartórios de protesto para determinação de prazos de pagamento e limite operacional.
                </p>
              </section>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: POLÍTICA DE PRIVACIDADE E LGPD                                     */}
          {/* ========================================================================= */}
          {activeTab === 'lgpd' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                <p>
                  Em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>, seus dados cadastrais e documentos são tratados com estrita segurança, confidencialidade e exclusivamente para finalidades legítimas e regulatórias.
                </p>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">1</span>
                  Dados Pessoais Coletados e Finalidade
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>Identificação e Contato:</strong> Nome completo, CPF, RG, e-mail e telefone celular/WhatsApp para comunicação institucional, confirmação de segurança e emissão de notas fiscais.</li>
                  <li><strong>Dados Profissionais:</strong> Número do CRMV e UF para validação de habilitação técnica perante o Conselho de Medicina Veterinária.</li>
                  <li><strong>Documentação Anexada:</strong> Documento pessoal do sócio/profissional, Contrato Social e Comprovante de Endereço unicamente para validação documental antifraude.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">2</span>
                  Bases Legais do Tratamento (Art. 7º da LGPD)
                </h3>
                <p>
                  O tratamento é realizado prioritariamente para: (I) cumprimento de obrigação legal e regulatória (MAPA, Receita Federal e Conselhos de Classe); (II) execução de procedimentos preliminares a contrato mercantil (credenciamento e fornecimento); e (III) legítimo interesse e prevenção a fraudes (Art. 11, II, "g").
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">3</span>
                  Compartilhamento de Dados
                </h3>
                <p>
                  A Vetline <strong>não comercializa</strong> dados pessoais em nenhuma hipótese. Os dados poderão ser compartilhados exclusivamente com sistemas de ERP (Moinho), transportadoras parceiras para entrega e órgãos fazendários para cumprimento de deveres tributários.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs">4</span>
                  Direitos do Titular & Canal DPO
                </h3>
                <p>
                  O titular poderá solicitar a confirmação da existência de tratamento, correção de dados incompletos ou inexatos, ou revogação de consentimentos não obrigatórios, enviando solicitação para o canal de privacidade: <strong>privacidade@vetline.com.br</strong>.
                </p>
              </section>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: POLÍTICA DE COOKIES                                                */}
          {/* ========================================================================= */}
          {activeTab === 'cookies' && (
            <div className="space-y-4 animate-fade-in">
              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-sm">
                  O que são Cookies e Como os Utilizamos?
                </h3>
                <p>
                  Cookies são pequenos arquivos de texto armazenados no seu navegador quando você acessa o portal da Vetline. Nós utilizamos cookies exclusivamente para garantir a operação técnica segura da plataforma, manter sua sessão conectada e proteger contra acessos maliciosos.
                </p>
              </section>

              {/* Tabela de Cookies */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Finalidade</th>
                      <th className="p-2.5">Tempo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr className="bg-white">
                      <td className="p-2.5 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                          <Check className="w-3 h-3 text-emerald-600" /> Essencial
                        </span>
                      </td>
                      <td className="p-2.5">
                        Tokens de autenticação segura e controle de sessão do usuário no Supabase Auth.
                      </td>
                      <td className="p-2.5 text-slate-500">Sessão</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2.5 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                          <Check className="w-3 h-3 text-emerald-600" /> Essencial
                        </span>
                      </td>
                      <td className="p-2.5">
                        Registro de consentimento de cookies e preferências de privacidade (`localStorage`).
                      </td>
                      <td className="p-2.5 text-slate-500">Persistente</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="p-2.5 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                          Segurança
                        </span>
                      </td>
                      <td className="p-2.5">
                        Prevenção a ataques CSRF, integridade de formulário e controle de requisições.
                      </td>
                      <td className="p-2.5 text-slate-500">Sessão</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500">
                Como nosso portal não utiliza cookies de publicidade invasiva ou rastreamento entre domínios de terceiros, a desativação de cookies essenciais pelo navegador poderá comprometer o login e envio do cadastro.
              </p>
            </div>
          )}

        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-brand-green" />
            <span>Versão homologada 1.0 (2026) • Vetline Distribuidora</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            {showAcceptButton && onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-brand-green hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Li e Concordo</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
