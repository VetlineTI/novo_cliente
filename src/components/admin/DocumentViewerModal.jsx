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
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

const getDecodedHtml = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('data:text/html') || rawUrl.startsWith('data:text/plain')) {
    try {
      const commaIdx = rawUrl.indexOf(',');
      if (commaIdx !== -1) {
        const meta = rawUrl.slice(0, commaIdx);
        const body = rawUrl.slice(commaIdx + 1);
        if (meta.includes('base64')) {
          return atob(body);
        }
        return decodeURIComponent(body);
      }
    } catch (e) {
      try {
        return unescape(rawUrl.slice(rawUrl.indexOf(',') + 1));
      } catch (e2) {
        return null;
      }
    }
  }
  return null;
};

export const DocumentViewerModal = ({ isOpen, onClose, document: docItem, doc }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [inlineHtml, setInlineHtml] = useState(null);
  const [blobPdfUrl, setBlobPdfUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const url = activeDoc?.url;
  const fileName = activeDoc?.fileName;
  const title = activeDoc?.title;
  const verificationBadge = activeDoc?.verificationBadge;
  const category = activeDoc?.category;
  const notes = activeDoc?.notes;

  useEffect(() => {
    let isMounted = true;
    setInlineHtml(null);
    setBlobPdfUrl(null);

    if (!url) return;

    // 1. Se for Data URI de imagem direta
    if (typeof url === 'string' && url.startsWith('data:image/')) {
      return;
    }

    // 2. Se for Data URI de PDF direto
    if (typeof url === 'string' && url.startsWith('data:application/pdf')) {
      return;
    }

    // 3. Se for Data URI de HTML ou texto
    const decoded = getDecodedHtml(url);
    if (decoded) {
      if (decoded.startsWith('%PDF')) {
        try {
          const rawBytes = url.substring(url.indexOf(',') + 1);
          const binaryStr = decodeURIComponent(rawBytes);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
          const objUrl = URL.createObjectURL(pdfBlob);
          if (isMounted) setBlobPdfUrl(objUrl);
          return;
        } catch (e) {}
      }
      
      // Se for imagem binária disfarçada em string (como JFIF / PNG)
      if (decoded.includes('JFIF') || decoded.startsWith('\xFF\xD8\xFF') || decoded.startsWith('\x89PNG')) {
        return;
      }

      // Apenas seta inlineHtml se for realmente estrutura HTML
      const trimmedDecoded = decoded.trim();
      if (
        trimmedDecoded.startsWith('<!DOCTYPE') || 
        trimmedDecoded.toLowerCase().startsWith('<html') ||
        trimmedDecoded.startsWith('<div') ||
        trimmedDecoded.startsWith('<table') ||
        trimmedDecoded.includes('</html>')
      ) {
        setInlineHtml(decoded);
      }
      return;
    }

    // 4. Se for imagem por extensão conhecida
    const cleanUrl = url.split('?')[0].toLowerCase();
    const isImageFile = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanUrl) || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName || '');
    if (isImageFile) {
      return;
    }

    // 5. Se for PDF direto por extensão
    if (cleanUrl.endsWith('.pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf'))) {
      return;
    }

    // 6. Se for URL HTTP/HTTPS genérica (ex: endpoint do Bureau que pode retornar PDF ou HTML)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      setIsLoading(true);
      fetch(url)
        .then(async (res) => {
          const contentType = (res.headers.get('content-type') || '').toLowerCase();
          
          if (contentType.includes('image/')) {
            return;
          }

          const blob = await res.blob();
          const headBuffer = await blob.slice(0, 8).arrayBuffer();
          const headBytes = new Uint8Array(headBuffer);
          const headStr = new TextDecoder().decode(headBuffer);

          // Verifica se é PDF (%PDF)
          if (headStr.startsWith('%PDF') || contentType.includes('application/pdf')) {
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const objUrl = URL.createObjectURL(pdfBlob);
            if (isMounted) {
              setBlobPdfUrl(objUrl);
              setInlineHtml(null);
            }
            return;
          }

          // Verifica se é imagem binária (JPEG \xFF\xD8, PNG \x89PNG, GIF, etc.)
          if (
            (headBytes[0] === 0xFF && headBytes[1] === 0xD8) ||
            (headBytes[0] === 0x89 && headBytes[1] === 0x50 && headBytes[2] === 0x4E && headBytes[3] === 0x47) ||
            (headBytes[0] === 0x47 && headBytes[1] === 0x49 && headBytes[2] === 0x46)
          ) {
            return;
          }

          // Verifica se é HTML válido
          const text = await blob.text();
          const trimmed = text.trim();
          if (
            contentType.includes('text/html') ||
            trimmed.startsWith('<!DOCTYPE') ||
            trimmed.toLowerCase().startsWith('<html') ||
            trimmed.startsWith('<div') ||
            trimmed.startsWith('<table') ||
            trimmed.includes('</html>')
          ) {
            if (isMounted) {
              setInlineHtml(text);
              setBlobPdfUrl(null);
            }
          }
        })
        .catch((err) => {
          console.warn('Carregamento de documento no modal:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [url, fileName]);

  if (!isOpen || !activeDoc) return null;

  const isDataImage = typeof url === 'string' && url.startsWith('data:image');
  const isPdfDoc = Boolean(blobPdfUrl || url?.toLowerCase().includes('.pdf') || fileName?.toLowerCase().endsWith('.pdf'));
  const isImage = !inlineHtml && !isPdfDoc && (
    isDataImage ||
    fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)$/) ||
    url?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/) ||
    url?.includes('photo-') ||
    (!url?.includes('.pdf') && !url?.includes('.html') && !url?.startsWith('data:text'))
  );

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    if (!url && !inlineHtml) return;
    if (inlineHtml) {
      const blob = new Blob([inlineHtml], { type: 'text/html;charset=utf-8' });
      const a = window.document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName || `${title || 'documento'}.html`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      return;
    }
    const a = window.document.createElement('a');
    a.href = blobPdfUrl || url;
    a.download = fileName || `${title || 'documento'}.pdf`;
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
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
              className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 hover:text-white rounded-lg border border-red-500/30 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área Central de Visualização */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center overflow-auto p-4 relative select-none">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-brand-green mb-3" />
              <span className="text-xs font-semibold">Carregando visualização do documento...</span>
            </div>
          ) : inlineHtml ? (
            <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden border border-slate-700 shadow-xl">
              <iframe
                srcDoc={inlineHtml}
                title={title || 'Documento'}
                className="w-full h-full border-0 bg-white"
              />
            </div>
          ) : (blobPdfUrl || url?.toLowerCase().includes('.pdf') || fileName?.toLowerCase().endsWith('.pdf')) ? (
            <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden border border-slate-700 shadow-xl">
              <iframe
                src={blobPdfUrl || url}
                title={title || 'Documento PDF'}
                className="w-full h-full border-0 bg-white"
              />
            </div>
          ) : url ? (
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
