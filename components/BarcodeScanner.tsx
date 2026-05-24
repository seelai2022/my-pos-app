'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface BarcodeScannerProps {
  onScanned: (code: string) => void;
  onClose: () => void;
}

// Beep sound helper
function beep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export default function BarcodeScanner({ onScanned, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const stoppedRef = useRef(false);
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);
  const [method, setMethod] = useState<'fast' | 'zxing' | null>(null);

  const stopAll = useCallback(() => {
    stoppedRef.current = true;
    cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleCode = useCallback((code: string) => {
    if (stoppedRef.current) return;
    const now = Date.now();
    // Debounce — ignore same code within 1.5s
    if (code === lastCodeRef.current && now - lastTimeRef.current < 1500) return;
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    beep();
    setDetected(true);
    stopAll();
    setTimeout(() => onScanned(code), 200);
  }, [onScanned, stopAll]);

  useEffect(() => {
    stoppedRef.current = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        });
        streamRef.current = stream;
        if (!videoRef.current || stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startDetection();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('ກະລຸນາ Allow Camera:\nSettings → Safari/Chrome → Camera → Allow');
        } else {
          setError('ບໍ່ສາມາດເຂົ້າເຖິງ Camera ໄດ້');
        }
      }
    };

    const startDetection = async () => {
      // Method 1: BarcodeDetector API (Chrome Android, Chrome desktop) — FASTEST
      if ('BarcodeDetector' in window) {
        setMethod('fast');
        try {
          const detector = new (window as unknown as { BarcodeDetector: new(opts: object) => { detect: (img: HTMLVideoElement) => Promise<Array<{rawValue: string}>> } }).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'itf', 'pdf417']
          });

          const scan = async () => {
            if (stoppedRef.current) return;
            if (videoRef.current?.readyState === 4) {
              try {
                const results = await detector.detect(videoRef.current);
                if (results.length > 0) {
                  handleCode(results[0].rawValue);
                  return;
                }
              } catch {}
            }
            animRef.current = requestAnimationFrame(scan);
          };
          scan();
          return;
        } catch {}
      }

      // Method 2: ZXing (iOS Safari, Firefox) — fallback
      setMethod('zxing');
      try {
        const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library');
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
          BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.ITF, BarcodeFormat.PDF_417,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, 200);

        if (stoppedRef.current || !streamRef.current || !videoRef.current) return;

        reader.decodeFromStream(streamRef.current, videoRef.current, (result) => {
          if (result && !stoppedRef.current) {
            handleCode(result.getText());
          }
        });
      } catch (e) {
        setError('ບໍ່ສາມາດໂຫລດ scanner ໄດ້');
      }
    };

    startCamera();
    return () => { stopAll(); };
  }, [handleCode, stopAll]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) { stopAll(); onClose(); } }}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden w-full sm:max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">ສະແກນ Barcode</h2>
            {method && (
              <p className="text-xs text-gray-400 mt-0.5">
                {method === 'fast' ? '⚡ Fast mode (BarcodeDetector)' : '📱 ZXing mode'}
              </p>
            )}
          </div>
          <button onClick={() => { stopAll(); onClose(); }} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Camera */}
        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '4/3' }}>
          {error ? (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <div>
                <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
                </svg>
                <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>
                <button onClick={() => { stopAll(); onClose(); }}
                  className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl">ປິດ</button>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay/>
              <canvas ref={canvasRef} className="hidden"/>

              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Dark overlay with cutout */}
                <div className="absolute inset-0 bg-black/40"/>
                {/* Scan box */}
                <div className={`relative z-10 w-64 h-44 ${detected ? 'border-4 border-green-400' : 'border-2 border-white'} rounded-2xl transition-colors`}>
                  {/* Corners */}
                  <div className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl ${detected ? 'border-green-400' : 'border-white'}`}/>
                  <div className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl ${detected ? 'border-green-400' : 'border-white'}`}/>
                  <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl ${detected ? 'border-green-400' : 'border-white'}`}/>
                  <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-xl ${detected ? 'border-green-400' : 'border-white'}`}/>

                  {/* Scan line animation */}
                  {!detected && (
                    <div className="absolute inset-x-4 h-0.5 bg-red-400 rounded-full top-1/2 opacity-80 animate-pulse"/>
                  )}

                  {/* Success checkmark */}
                  {detected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-green-400 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 text-center">
          {detected ? (
            <p className="text-sm text-green-600 font-semibold">✅ ສະແກນສຳເລັດ!</p>
          ) : error ? null : (
            <p className="text-sm text-gray-500">ວາງ barcode ໃຫ້ຢູ່ໃນກອບ</p>
          )}
          <button onClick={() => { stopAll(); onClose(); }}
            className="mt-2 text-xs text-gray-400 underline">ຍົກເລີກ</button>
        </div>
      </div>
    </div>
  );
}
