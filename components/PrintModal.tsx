'use client';

import { useRef, useState } from 'react';
import { type Order } from '@/lib/supabase';
import Receipt from './Receipt';

interface PrintModalProps {
  order: Order;
  onClose: () => void;
}

// Convert canvas to ESC/POS raster bytes
function canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const PAPER_WIDTH = 576; // 80mm at 203dpi
  const bytesPerRow = Math.ceil(PAPER_WIDTH / 8);

  const result: number[] = [];
  // Init printer
  result.push(0x1b, 0x40);
  // Set line spacing to 0
  result.push(0x1b, 0x33, 0x00);

  for (let y = 0; y < height; y++) {
    // Raster bit image command
    result.push(0x1b, 0x2a, 0x00);
    result.push(PAPER_WIDTH & 0xff, (PAPER_WIDTH >> 8) & 0xff);

    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const brightness = (r + g + b) / 3;
          if (brightness < 128) {
            byte |= (0x80 >> bit);
          }
        }
      }
      result.push(byte);
    }
    result.push(0x0a);
  }

  // Feed and cut
  result.push(0x1b, 0x33, 0x18); // Reset line spacing
  result.push(0x0a, 0x0a, 0x0a);
  result.push(0x1d, 0x56, 0x41); // Full cut

  return new Uint8Array(result);
}

export default function PrintModal({ order, onClose }: PrintModalProps) {
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    const settings = (() => {
      try { return JSON.parse(localStorage.getItem('pos_settings') || '{}'); } catch { return {}; }
    })();

    if ((settings.printerType === 'thermal_network' || settings.printerType === 'network') && settings.printerNetworkIP) {
      setPrinting(true);
      try {
        const content = printRef.current;
        if (!content) throw new Error('No content');

        const ip = settings.printerNetworkIP;
        const port = settings.printerNetworkPort || '8443';

        // Render HTML to canvas using html2canvas-like approach
        const PAPER_WIDTH = 576;
        const scale = PAPER_WIDTH / content.offsetWidth;

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = PAPER_WIDTH;
        canvas.height = Math.ceil(content.offsetHeight * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        // Use foreignObject via SVG to render HTML
        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${content.offsetWidth}" height="${content.offsetHeight}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Noto Sans Lao', Arial, sans-serif; font-size: 12px;">
              ${content.innerHTML}
            </div>
          </foreignObject>
        </svg>`;

        const img = new Image();
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = reject;
          img.src = url;
        });

        // Convert canvas to ESC/POS bytes
        const escposBytes = canvasToEscPos(canvas);

        const response = await fetch(`https://${ip}:${port}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: escposBytes,
        });

        if (response.ok) { setPrinting(false); onClose(); return; }
      } catch (e) {
        console.error('Network print error:', e);
      }
      setPrinting(false);
    }

    // Fallback: browser print
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=900,height=600');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>ໃບເກັບເງິນ</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}
      @media print{body{margin:0;}@page{size:${format === 'thermal' ? '80mm auto' : 'A4'};margin:0;}}</style>
      </head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-medium text-gray-800">ພິມໃບເກັບເງິນ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Format selector */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => setFormat('thermal')}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all
                ${format === 'thermal' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              🖨️ Thermal (80mm)
            </button>
            <button onClick={() => setFormat('a4')}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all
                ${format === 'a4' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              📄 A4
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6 flex justify-center">
          <div className="shadow-lg" ref={printRef}>
            <Receipt order={order} format={format} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            ປິດ
          </button>
          <button onClick={handlePrint} disabled={printing}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
            </svg>
            {printing ? 'ກຳລັງພິມ...' : 'ພິມ'}
          </button>
        </div>
      </div>
    </div>
  );
}
