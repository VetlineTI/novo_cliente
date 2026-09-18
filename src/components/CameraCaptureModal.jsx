import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, FlipHorizontal } from 'lucide-react';

export const CameraCaptureModal = ({ isOpen, onClose, onCapture, documentLabel = 'Documento' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (traseira) ou 'user' (frontal)
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inicia a câmera
  const startCamera = async () => {
    setIsLoading(true);
    setCameraError(null);

    // Para stream anterior se existir
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsLoading(false);
    } catch (err) {
      setCameraError('Não foi possível acessar a câmera. Verifique as permissões do seu navegador.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Fecha o modal e desliga a câmera
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCapturedImage(null);
    onClose();
  };

  // Alterna entre câmera frontal e traseira
  const handleFlipCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Tira a foto
  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `foto_${documentLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedImage({ file, previewUrl });
      }
    }, 'image/jpeg', 0.92);
  };

  // Confirma o uso da foto capturada
  const handleConfirmPhoto = () => {
    if (capturedImage?.file) {
      onCapture(capturedImage.file);
      handleClose();
    }
  };

  // Retira a foto
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[95vh] text-white">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-green/20 text-brand-green flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Fotografar {documentLabel}</h3>
              <p className="text-[11px] text-slate-400">Posicione o documento dentro da moldura</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área da Câmera / Visualização */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] sm:min-h-[400px] overflow-hidden">
          <canvas ref={canvasRef} className="hidden" />

          {cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-xs">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-red-300">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Tentar Novamente
              </button>
            </div>
          ) : !capturedImage ? (
            <>
              {/* Vídeo ao vivo */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Moldura Guia de Enquadramento */}
              <div className="absolute inset-4 sm:inset-8 border-2 border-brand-green/70 rounded-2xl pointer-events-none shadow-2xl flex flex-col justify-between p-3 sm:p-4">
                <span className="text-[10px] uppercase font-bold text-brand-green bg-slate-900/80 px-2 py-0.5 rounded self-start tracking-wider">
                  Enquadre o documento
                </span>
                <span className="text-[10px] text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded self-center text-center">
                  Evite reflexos e garanta boa iluminação
                </span>
              </div>
            </>
          ) : (
            /* Prévia da Foto Capturada */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedImage.previewUrl}
                alt="Foto Capturada"
                className="max-h-[420px] w-auto object-contain rounded-xl"
              />
            </div>
          )}
        </div>

        {/* Rodapé com Controles */}
        <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          {!capturedImage ? (
            <>
              {/* Alternar Câmera */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                title="Alternar Câmera"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>

              {/* Botão de Disparo */}
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={isLoading || Boolean(cameraError)}
                className="w-16 h-16 rounded-full border-4 border-brand-green bg-white flex items-center justify-center text-slate-900 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-green/30 disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-full bg-brand-green flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              <div className="w-11" /> {/* Espaçador para balancear grid */}
            </>
          ) : (
            /* Ações da Foto Capturada */
            <div className="w-full flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-800 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tirar Outra</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="px-5 py-2.5 rounded-xl bg-brand-green text-slate-900 text-xs sm:text-sm font-bold hover:bg-brand-green-dark shadow-md shadow-brand-green/20 flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Usar Esta Foto</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
