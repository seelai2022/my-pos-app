'use client';

import { useRef, useState } from 'react';
import { type Order } from '@/lib/supabase';
import Receipt from './Receipt';

interface PrintModalProps {
  order: Order;
  onClose: () => void;
}

async function drawReceiptToPNG(order: Order): Promise<Blob> {
  await document.fonts.ready;

  const PAPER_WIDTH = 576;
  const METHOD_LABEL: Record<string, string> = { cash: 'ເງິນສົດ', qr: 'QR Code', card: 'ບັດ' };
  const items = order.order_items ?? [];
  const settings = (() => { try { return JSON.parse(localStorage.getItem('pos_settings') || '{}'); } catch { return {}; } })();

  const F = (size: number, bold = false) => `${bold ? 'bold ' : ''}${size}px "Noto Sans Lao", Arial, sans-serif`;

  // Measure height
  const lineH = 26;
  const totalH = 160 + items.length * lineH * 2 + 180;

  const canvas = document.createElement('canvas');
  canvas.width = PAPER_WIDTH;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PAPER_WIDTH, totalH);
  ctx.fillStyle = '#000';

  let y = 30;

  const dash = () => {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(PAPER_WIDTH - 10, y); ctx.stroke();
    ctx.restore();
    y += 16;
  };

  // Header
  ctx.font = F(22, true); ctx.textAlign = 'center';
  ctx.fillText(settings.storeName || 'KL Shop', PAPER_WIDTH / 2, y); y += 28;
  ctx.font = F(13);
  if (settings.storeAddress) { ctx.fillText(settings.storeAddress, PAPER_WIDTH / 2, y); y += 22; }
  if (settings.storePhone) { ctx.fillText(settings.storePhone, PAPER_WIDTH / 2, y); y += 22; }
  dash();

  // Order info
  ctx.font = F(13); ctx.textAlign = 'left';
  const date = new Date(order.created_at);
  ctx.fillText(`ບິນ: #${order.id.slice(-8).toUpperCase()}`, 10, y); y += 22;
  ctx.fillText(`ວັນທີ: ${date.toLocaleDateString('lo-LA')}`, 10, y); y += 22;
  ctx.fillText(`ເວລາ: ${date.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}`, 10, y); y += 22;
  ctx.fillText(`ຊຳລະ: ${METHOD_LABEL[order.payment_method] ?? order.payment_method}`, 10, y); y += 22;
  dash();

  // Items
  for (const item of items) {
    ctx.font = F(13); ctx.textAlign = 'left';
    const name = item.product_name.length > 28 ? item.product_name.slice(0, 28) + '...' : item.product_name;
    ctx.fillText(name, 10, y); y += 22;
    ctx.font = F(12); ctx.textAlign = 'left';
    ctx.fillText(`  ${item.price.toLocaleString()} x ${item.quantity}`, 10, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${(item.price * item.quantity).toLocaleString()} ₭`, PAPER_WIDTH - 10, y);
    y += 24;
  }
  dash();

  // Total
  ctx.font = F(15, true); ctx.textAlign = 'left';
  ctx.fillText('ລວມທັງໝົດ', 10, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${order.total.toLocaleString()} ₭`, PAPER_WIDTH - 10, y); y += 28;

  if (order.payment_method === 'cash' && order.received) {
    ctx.font = F(13); ctx.textAlign = 'left';
    ctx.fillText('ຮັບມາ', 10, y); ctx.textAlign = 'right';
    ctx.fillText(`${order.received.toLocaleString()} ₭`, PAPER_WIDTH - 10, y); y += 22;
    ctx.textAlign = 'left';
    ctx.fillText('ເງິນທອນ', 10, y); ctx.textAlign = 'right';
    ctx.fillText(`${(order.change ?? 0).toLocaleString()} ₭`, PAPER_WIDTH - 10, y); y += 22;
  }
  dash();

  ctx.font = F(13); ctx.textAlign = 'center';
  ctx.fillText('ຂອບໃຈທີ່ໃຊ້ບໍລິການ', PAPER_WIDTH / 2, y);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
  });
}

export default function PrintModal({ order, onClose }: PrintModalProps) {
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    const settings = (() => { try { return JSON.parse(localStorage.getItem('pos_settings') || '{}'); } catch { return {}; } })();

    if ((settings.printerType === 'thermal_network' || settings.printerType === 'network') && settings.printerNetworkIP) {
      setPrinting(true);
      try {
        const ip = settings.printerNetworkIP;
        const port = settings.printerNetworkPort || '8443';
        const blob = await drawReceiptToPNG(order);
        const response = await fetch(`https://${ip}:${port}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: blob,
        });
        if (response.ok) { setPrinting(false); onClose(); return; }
        throw new Error('Print failed: ' + response.status);
      } catch (e) {
        console.error('Network print error:', e);
        alert('ພິມບໍ່ສຳເລັດ: ' + e);
      }
      setPrinting(false);
      return;
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-medium text-gray-800">ພິມໃບເກັບເງິນ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => setFormat('thermal')}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${format === 'thermal' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              🖨️ Thermal (80mm)
            </button>
            <button onClick={() => setFormat('a4')}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${format === 'a4' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              📄 A4
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6 flex justify-center">
          <div className="shadow-lg" ref={printRef}>
            <Receipt order={order} format={format} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">ປິດ</button>
          <button onClick={handlePrint} disabled={printing}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 flex items-center justify-center gap-2 disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
            </svg>
            {printing ? 'ກຳລັງພິມ...' : 'ພິມ'}
          </button>
        </div>
      </div>
    </div>
  );
}
