import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, HelpCircle, Check, Sparkles } from 'lucide-react';

export const SEGMENT_GUIDE_DATA = [
  {
    icon: '🐾',
    name: 'Pet Shop',
    value: 'PET SHOP',
    description: 'Possui uma loja que comercializa produtos para cães, gatos e outros animais, sem clínica ou banho e tosa como atividade principal.'
  },
  {
    icon: '🏥',
    name: 'Pet Shop com Clínica',
    value: 'PET SHOP COM CLINICA',
    description: 'Possui um pet shop e também oferece atendimento ou serviços veterinários no estabelecimento.'
  },
  {
    icon: '✂️',
    name: 'Pet Shop com Banho e Tosa',
    value: 'PET SHOP COM BANHO E TOSA',
    description: 'Possui um pet shop e também oferece serviços de banho e tosa.'
  },
  {
    icon: '⭐',
    name: 'Pet Shop Completo',
    value: 'PET SHOP COMPLETO',
    description: 'Possui loja + banho e tosa + clínica/atendimento veterinário no mesmo estabelecimento.'
  },
  {
    icon: '🌱',
    name: 'Loja Agropecuária',
    value: 'LOJA AGROPECUARIA',
    description: 'Comercializa produtos agropecuários, produtos para grandes animais, produção animal ou mercado agro.'
  },
  {
    icon: '✂️',
    name: 'Banho e Tosa',
    value: 'BANHO E TOSA',
    description: 'Atua principalmente com serviços de banho, tosa e estética animal, sem uma loja de produtos como atividade principal.'
  },
  {
    icon: '🏥',
    name: 'Hospital Veterinário',
    value: 'HOSPITAL VETERINARIO',
    description: 'Oferece atendimento veterinário com estrutura de internação, exames e procedimentos, podendo contar com atendimento especializado ou 24 horas.'
  },
  {
    icon: '🩺',
    name: 'Clínica Veterinária',
    value: 'CLINICA VETERINARIA',
    description: 'Atua principalmente com consultas, atendimento veterinário, exames e procedimentos clínicos.'
  },
  {
    icon: '👨‍⚕️',
    name: 'Veterinário Autônomo',
    value: 'VETERINARIO AUTONOMO',
    description: 'Você é médico-veterinário e atua de forma autônoma, como pessoa física, MEI ou outra modalidade profissional.'
  },
  {
    icon: '🛒',
    name: 'E-commerce',
    value: 'E-COMMERCE',
    description: 'Sua atividade principal é a venda de produtos pela internet, por site, marketplace ou outros canais digitais.'
  },
  {
    icon: '🎓',
    name: 'Instituição de Ensino',
    value: 'INSTITUIÇAO DE ENSINO',
    description: 'É uma universidade, faculdade, escola, centro de formação ou instituição de ensino.'
  },
  {
    icon: '🐶',
    name: 'Criador',
    value: 'CRIADOR',
    description: 'Atua na criação e reprodução de cães e/ou gatos.'
  },
  {
    icon: '👤',
    name: 'Funcionário',
    value: 'FUNCIONARIO',
    description: 'Você é funcionário ou colaborador da Vetline e o cadastro será utilizado para fins internos.'
  },
  {
    icon: '📦',
    name: 'Atacadista',
    value: 'ATACADISTA',
    description: 'Compra produtos em grandes quantidades para revender para lojas, varejistas ou outros comerciantes.'
  },
  {
    icon: '🐄',
    name: 'Animais de Produção',
    value: 'ANIMAIS DE PRODUÇAO',
    description: 'Atua com bovinos, aves, suínos ou outros animais de produção, incluindo atividades relacionadas às linhas VLF e VLN.'
  },
  {
    icon: '🏭',
    name: 'Indústria VLF',
    value: 'INDUSTRIA VLF',
    description: 'É uma indústria de ração PET, suplementação, produtos biológicos ou outros produtos relacionados à linha VLF.'
  },
  {
    icon: '🤝',
    name: 'ONG',
    value: 'ONGs',
    description: 'É uma organização sem fins lucrativos que utiliza os produtos em suas atividades ou projetos.'
  },
  {
    icon: '🏨',
    name: 'Hotel / Creche',
    value: 'HOTEL / CRECHE',
    description: 'Oferece hospedagem, permanência, recreação ou cuidados temporários para animais.'
  },
  {
    icon: '🚚',
    name: 'Transportadora',
    value: 'TRANSPORTADORA',
    description: 'Presta serviços de transporte, coleta ou entrega para a Vetline.'
  },
  {
    icon: '🔬',
    name: 'Laboratório de Exames',
    value: 'LABORATORIO DE EXAMES',
    description: 'Atua principalmente com exames laboratoriais, análises e diagnósticos relacionados à saúde animal.'
  },
  {
    icon: '🏛️',
    name: 'Prefeitura',
    value: 'PREFEITURA',
    description: 'É uma prefeitura ou órgão da administração pública municipal.'
  },
  {
    icon: '🏢',
    name: 'Fornecedor',
    value: 'FORNECEDOR',
    description: 'Fornece produtos, serviços ou insumos para a Vetline.'
  },
  {
    icon: '📦',
    name: 'Distribuidor',
    value: 'DISTRIBUIDORA',
    description: 'Atua na distribuição e comercialização de produtos para outros clientes ou empresas.'
  },
  {
    icon: '🔹',
    name: 'Outros Segmentos',
    value: 'OUTROS SEGMENTOS',
    description: 'Sua empresa não se enquadra em nenhuma das categorias acima, como mercado, loja de materiais de construção, loja de piscina ou outros estabelecimentos.'
  }
];

export const SegmentHelpModal = ({ 
  isOpen, 
  onClose, 
  onSelectSegment, 
  currentValue 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return SEGMENT_GUIDE_DATA;
    const term = searchTerm.toLowerCase().trim();
    return SEGMENT_GUIDE_DATA.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.value.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-start justify-center p-3 sm:p-5 pt-4 sm:pt-8 md:pt-12 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[88vh] transition-all my-auto sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-brand-green flex items-center justify-center shrink-0 shadow-2xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                Como identificar o segmento da sua empresa
              </h2>
              <p className="text-xs text-slate-500">
                Consulte o guia abaixo para escolher a opção mais adequada ao seu negócio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-end sm:self-auto w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Pesquisa Rápida */}
        <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por segmento ou atividade (ex: clínica, agro, banho...)"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-slate-50/50 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabela de Segmentos com Scroll */}
        <div className="p-0 overflow-y-auto flex-1 divide-y divide-slate-100">
          {filteredSegments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
              <p className="font-medium">Nenhum segmento encontrado para "{searchTerm}".</p>
              <p className="text-slate-400 mt-1">Tente buscar por outro termo ou limpe a busca.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200/80 backdrop-blur-xs">
                <tr>
                  <th className="py-2.5 px-3 sm:px-4 text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider w-[36%] sm:w-[32%]">
                    Segmento
                  </th>
                  <th className="py-2.5 px-3 sm:px-4 text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Você se enquadra aqui se...
                  </th>
                  {onSelectSegment && (
                    <th className="py-2.5 px-3 text-right text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider w-20 sm:w-28 pr-4">
                      Ação
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredSegments.map((item) => {
                  const isSelected = currentValue === item.value;
                  return (
                    <tr
                      key={item.value}
                      onClick={() => {
                        if (onSelectSegment) {
                          onSelectSegment(item.value);
                          onClose();
                        }
                      }}
                      className={`group transition-colors ${
                        isSelected 
                          ? 'bg-emerald-50/70 hover:bg-emerald-50' 
                          : 'hover:bg-slate-50/80'
                      } ${onSelectSegment ? 'cursor-pointer' : ''}`}
                    >
                      <td className="py-3 px-3 sm:px-4 align-top font-semibold text-slate-800">
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <span className="text-base sm:text-lg shrink-0 select-none">{item.icon}</span>
                          <span className="leading-snug">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4 align-top text-slate-600 leading-relaxed text-xs sm:text-[13px]">
                        {item.description}
                      </td>
                      {onSelectSegment && (
                        <td className="py-3 px-3 sm:px-4 align-middle text-right whitespace-nowrap">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-md">
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Selecionado</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSegment(item.value);
                                onClose();
                              }}
                              className="text-[11px] font-medium text-brand-green hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/60 transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                            >
                              Selecionar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé Informativo e Fechamento */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] sm:text-xs text-center sm:text-left">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Caso sua empresa realize mais de uma atividade, selecione a que representa sua atividade principal.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
