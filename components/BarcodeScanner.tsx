'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScanned: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanned, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<unknown>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;

        if (!videoRef.current || stoppedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        if (stoppedRef.current) return;

        // Use decodeFromStream for continuous scanning
        reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (stoppedRef.current) return;
          if (result) {
            const code = result.getText();
            setScanning(false);
            stoppedRef.current = true;
            stopScanner();
            onScanned(code);
          }
          // Ignore errors — they fire constantly when no barcode found
        });

      } catch (e: unknown) {
        if (!stoppedRef.current) {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('Permission') || msg.includes('NotAllowed')) {
            setError('ກະລຸນາ Allow Camera ໃນ Settings ຂອງ iPhone:\nSettings → Safari → Camera → Allow');
          } else {
            setError('ບໍ່ສາມາດເຂົ້າເຖິງ Camera ໄດ້');
          }
        }
      }
    };

    const stopScanner = () => {
      stoppedRef.current = true;
      if (readerRef.current) {
        try { (readerRef.current as { reset: () => void }).reset(); } catch {}
        readerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };

    startScanner();

    return () => {
      stoppedRef.current = true;
      if (readerRef.current) {
        try { (readerRef.current as { reset: () => void }).reset(); } catch {}
        readerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [onScanned]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden w-full sm:max-w-sm shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">ສະແກນ Barcode</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black overflow-hidden" style={{ aspectRatio: '4/3' }}>
          {error ? (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <div>
                <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
                </svg>
                <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl">ປິດ</button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-56 h-36">
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-3 border-l-3 border-white rounded-tl-sm" style={{ borderWidth: 3 }}/>
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-3 border-r-3 border-white rounded-tr-sm" style={{ borderWidth: 3 }}/>
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-3 border-l-3 border-white rounded-bl-sm" style={{ borderWidth: 3 }}/>
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-3 border-r-3 border-white rounded-br-sm" style={{ borderWidth: 3 }}/>
                  {/* Scanning line */}
                  {scanning && (
                    <div className="absolute inset-x-0 h-0.5 bg-red-400 opacity-80 top-1/2 animate-pulse"/>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 text-center">
          {scanning && !error ? (
            <p className="text-sm text-gray-500">ວາງ barcode ໃຫ້ຢູ່ໃນກອບສີຂາວ</p>
          ) : (
            <p className="text-sm text-green-600 font-medium">✅ ສະແກນສຳເລັດ!</p>
          )}
          <button onClick={onClose} className="mt-2 text-xs text-gray-400 underline">ຍົກເລີກ</button>
        </div>
      </div>
    </div>
  );
}
