'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScanned: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanned, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let stopped = false;

    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const { BrowserMultiFormatReader } = await import('@zxing/library');
          const reader = new BrowserMultiFormatReader();

          const result = await reader.decodeFromVideoElement(videoRef.current);
          if (!stopped && result) {
            onScanned(result.getText());
          }
        }
      } catch (e) {
        if (!stopped) {
          setError('ບໍ່ສາມາດເຂົ້າເຖິງ Camera ໄດ້ ກະລຸນາອະນຸຍາດການໃຊ້ Camera');
        }
      }
    };

    startScanner();

    return () => {
      stopped = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [onScanned]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-800">ສະແກນ Barcode</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="relative bg-black aspect-square">
          {error ? (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline/>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-52 h-32 relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl"/>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr"/>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl"/>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br"/>
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-400 opacity-70 animate-pulse"/>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 text-center">
          <p className="text-xs text-gray-400">ວາງ barcode ໃຫ້ຢູ່ໃນກອບ</p>
        </div>
      </div>
    </div>
  );
}
