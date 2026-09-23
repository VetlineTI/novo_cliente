import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  X, 
  AlertCircle, 
  Camera, 
  Loader2, 
  ShieldCheck, 
  QrCode, 
  FileCheck2,
  AlertTriangle
} from 'lucide-react';
import { formatFileSize } from '../utils/masks';
import { CameraCaptureModal } from './CameraCaptureModal';
import { validateDocumentAttachment } from '../utils/documentValidator';

export const DocumentUpload = ({
  label,
  file,
  onFileChange,
  required = false,
  error = null,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMB = 5,
  helperText = 'PDF, JPG ou PNG',
  maxSizeText = 'Máx. 5MB',
  expectedDocument = '',
  expectedName = '',
  expectedPartners = [],
  category = 'IDENTIFICATION'
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const processAndValidateFile = async (selectedFile) => {
    setUploadError(null);
    setValidationResult(null);
    if (!selectedFile) return;

    // 1. Valida tamanho do arquivo
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setUploadError(`O arquivo ultrapassa o limite de ${maxSizeMB}MB.`);
      return;
    }

    // 2. Valida tipo de arquivo
    const allowedExtensions = accept.split(',').map((ext) => ext.trim().toLowerCase());
    const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExt) && !allowedExtensions.includes('*')) {
      setUploadError('Formato inválido. Use PDF, JPG ou PNG.');
      return;
    }

    // Define o arquivo
    onFileChange(selectedFile);

    // 3. Executa Validação Inteligente (OCR e QR Code)
    setIsValidating(true);
    try {
      const result = await validateDocumentAttachment(selectedFile, {
        expectedDocument,
        expectedName,
        expectedPartners,
        category
      });
      setValidationResult(result);
    } catch (err) {
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndValidateFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onFileChange(null);
    setUploadError(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processAndValidateFile(e.target.files[0]);
          }
        }}
        accept={accept}
        className="hidden"
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 min-h-[175px] h-full ${
          file
            ? (validationResult?.isWarning || validationResult?.isValid === false)
              ? 'border-amber-400 bg-amber-50/50 shadow-xs'
              : 'border-brand-green bg-brand-green-light/50 shadow-xs'
            : isDragging
            ? 'border-brand-green bg-brand-green-light shadow-md scale-[1.01]'
            : error || uploadError
            ? 'border-red-300 bg-red-50/30'
            : 'border-dashed border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
        }`}
      >
        {/* Título do Documento */}
        <div className="w-full text-center">
          <span className="font-semibold text-slate-800 text-xs sm:text-sm px-1 leading-snug inline-block">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </div>

        {/* Estado 1: Nenhum arquivo selecionado (Botões de Upload e Câmera) */}
        {!file ? (
          <div className="my-2 flex flex-col items-center space-y-2.5 w-full">
            <div className="flex items-center justify-center gap-2">
              {/* Botão de Anexo de Arquivo */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-brand-teal" />
                <span>Anexar</span>
              </button>

              {/* Botão de Câmera (Tirar Foto) */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green-light hover:bg-brand-green/20 text-brand-dark font-semibold text-xs transition-colors cursor-pointer border border-brand-green/40"
              >
                <Camera className="w-3.5 h-3.5 text-brand-green" />
                <span>Câmera</span>
              </button>
            </div>

            <div className="text-center">
              <span className="text-[11px] text-slate-500 block font-medium">{helperText}</span>
              <span className="text-[10px] text-slate-400 block">{maxSizeText}</span>
            </div>
          </div>
        ) : (
          /* Estado 2: Arquivo Selecionado com Validador Inteligente */
          <div className="my-2 w-full flex flex-col items-center space-y-2 px-1 text-center">
            
            {/* Status do Scanner */}
            {isValidating ? (
              <div className="inline-flex items-center gap-1.5 bg-white/90 px-2.5 py-1 rounded-full border border-slate-200 shadow-xs animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-teal" />
                <span className="text-[11px] font-semibold text-slate-700">Validando documento...</span>
              </div>
            ) : validationResult ? (
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs ${
                  validationResult.status === 'VERIFIED_QR'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : validationResult.status === 'VERIFIED_MATCH'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : (validationResult.isWarning || validationResult.isValid === false)
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {validationResult.qrFound && validationResult.isValid ? (
                  <QrCode className="w-3.5 h-3.5 text-brand-green" />
                ) : (validationResult.isWarning || validationResult.isValid === false) ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-brand-green" />
                )}
                <span>{validationResult.badge || 'Documento Validado'}</span>
              </div>
            ) : null}

            {/* Nome e Tamanho do Arquivo */}
            <div className="space-y-0.5 max-w-full px-2">
              <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                {file.name}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                {formatFileSize(file.size)}
              </span>
            </div>

            {/* Mensagem Explicativa da Validação */}
            {validationResult?.message && (
              <p className={`text-[10px] leading-tight px-1 font-medium ${
                validationResult.isValid === false || validationResult.isWarning
                  ? 'text-amber-800 font-semibold'
                  : 'text-slate-600'
              }`}>
                {validationResult.message}
              </p>
            )}
          </div>
        )}

        {/* Rodapé do Card: Ação de Remover ou Trocar */}
        {file ? (
          <button
            type="button"
            onClick={handleRemove}
            className="text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Remover ou trocar</span>
          </button>
        ) : (
          <span className="text-[10px] text-slate-400">
            Arraste ou clique para enviar
          </span>
        )}
      </div>

      {/* Exibição de Erro de Upload */}
      {(uploadError || error) && (
        <div className="flex items-center gap-1 text-[11px] text-red-600 mt-1.5 px-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{uploadError || error}</span>
        </div>
      )}

      {/* Modal da Câmera em Tempo Real */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(capturedFile) => processAndValidateFile(capturedFile)}
        documentLabel={label}
      />
    </div>
  );
};
