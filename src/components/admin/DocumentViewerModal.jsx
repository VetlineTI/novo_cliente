import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  ShieldCheck, 
  Maximize2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const DocumentViewerModal = ({ isOpen, onClose, document: docItem, doc }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const activeDoc = docItem || doc;

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      if (typeof window !== 'undefined' && window.document?.body) {
        window.document.body.style.overflow = 'hidden';
      }
    }
    return () => {
      if (typeof window !== 'undefined' && window.document?.body) {
        window.document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen]);

  if (!isOpen || !activeDoc) return null;

  const { title, url, fileName, type, verificationBadge, category, notes } = activeDoc;

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || url?.toLowerCase().includes('.pdf') || type === 'pdf';
  const isHtml = !isPdf && (
    fileName?.toLowerCase().endsWith('.html') || 
    url?.toLowerCase().includes('.html') || 
    type === 'html'
  );
  const isImage = !isPdf && !isHtml && (
    fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)$/) ||
    url?.startsWith('data:image') ||
    url?.includes('photo-') ||
    type === 'image' ||
    true // Padrão se não for PDF nem HTML
  );

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    if (!url) return;
    const a = window.document.createElement('a');
    a.href = url;
    a.download = fileName || `${title || 'documento'}.jpg`;
    a.target = '_blank';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Barra Superior de Controles */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 z-10 flex-wrap gap-2">
          
          {/* Informações do Documento */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-green/20 text-brand-green flex items-center justify-center flex-shrink-0 border border-brand-green/30">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {title || 'Visualizador de Documento'}
                </h3>
                {verificationBadge && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    {verificationBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {category && <span className="font-medium text-slate-300">{category} • </span>}
                {fileName || 'Arquivo digitalizado'}
              </p>
            </div>
          </div>

          {/* Ferramentas de Visualização e Fechar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Controles de Zoom (para imagens) */}
            {isImage && (
              <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg p-0.5 text-slate-300">
                <button
                  onClick={handleZoomOut}
                  title="Diminuir Zoom"
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-2 text-slate-400 select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  title="Aumentar Zoom"
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  title="Girar 90°"
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition-colors border-l border-slate-700 ml-0.5"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Baixar Arquivo */}
            <button
              onClick={handleDownload}
              title="Baixar Documento"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-brand-green" />
              <span className="hidden sm:inline">Baixar</span>
            </button>

            {/* Abrir em nova aba */}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir em Nova Aba"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Botão Fechar */}
            <button
              onClick={onClose}
              title="Fechar (Esc)"
              className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 hover:text-white rounded-lg border border-red-500/30 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área Central de Visualização */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center overflow-auto p-4 relative select-none">
          {url ? (
            isPdf || isHtml ? (
              <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden border border-slate-700 shadow-xl">
                <iframe
                  src={isPdf ? `${url}#toolbar=1&navpanes=0` : url}
                  title={title || 'Documento'}
                  sandbox={isHtml ? "allow-same-origin allow-popups" : undefined}
                  className="w-full flex-1 border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center min-w-full min-h-full transition-transform duration-200">
                <img
                  src={url}
                  alt={title || 'Documento do Cliente'}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="max-h-[72vh] max-w-[85vw] object-contain rounded shadow-lg"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/800x600/1e293b/ffffff?text=Documento+Anexado';
                  }}
                />
              </div>
            )
          ) : (
            <div className="text-center p-8 text-slate-400">
              <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">Nenhum arquivo disponível para pré-visualização</p>
              <p className="text-xs text-slate-500 mt-1">O documento não possui URL válida de armazenamento.</p>
            </div>
          )}
        </div>

        {/* Rodapé com Informações Extras de Validação */}
        {notes && (
          <div className="px-6 py-2.5 bg-slate-900/95 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-green flex-shrink-0" />
              <span>{notes}</span>
            </div>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              Ambiente Seguro Vetline • Gestão de Documentos
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
