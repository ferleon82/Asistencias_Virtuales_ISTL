import { useEffect, useRef, useState } from 'react';

interface CameraCaptureModalProps {
  action: 'entrada' | 'salida';
  loading: boolean;
  onCancel: () => void;
  onConfirm: (photoBase64: string) => void;
}

export function CameraCaptureModal({ action, loading, onCancel, onConfirm }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoBase64, setPhotoBase64] = useState('');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError('No se pudo acceder a la cámara. Revise los permisos del navegador.');
      }
    };

    void startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);
    setPhotoBase64(canvas.toDataURL('image/jpeg', 0.78));
  };

  const retakePhoto = () => {
    setPhotoBase64('');
    window.setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        void videoRef.current.play();
      }
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Verificación con cámara</h2>
            <p className="section-subtitle">
              Capture una foto para marcar {action === 'entrada' ? 'ingreso' : 'salida'}.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary px-3">
            X
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-slate-950">
          {photoBase64 ? (
            <img src={photoBase64} alt="Foto capturada" className="h-72 w-full object-cover" />
          ) : (
            <video ref={videoRef} className="h-72 w-full object-cover" playsInline muted />
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {cameraError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {cameraError}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={photoBase64 ? retakePhoto : capturePhoto}
            disabled={loading || !!cameraError}
            className="btn-secondary"
          >
            {photoBase64 ? 'Tomar otra' : 'Capturar foto'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(photoBase64)}
            disabled={loading || !photoBase64}
            className="btn-primary"
          >
            {loading ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
