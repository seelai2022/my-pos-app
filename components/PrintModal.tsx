'use client';

import { useRef, useState } from 'react';
import { type Order } from '@/lib/supabase';
import Receipt from './Receipt';
import { printReceipt } from '@/lib/escpos';

interface PrintModalProps {
  order: Order;
  onClose: () => void;
}

export default function PrintModal({ order, onClose }: PrintModalProps) {
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    // Try network print first
    const settings = (() => {
      try { return JSON.parse(localStorage.getItem('pos_settings') || '{}'); } catch { return {}; }
    })();

    if (settings.printerType === 'thermal_network' || settings.printerType === 'both') {
      setPrinting(true);
      const result = await printReceipt({
        storeName: settings.storeName || 'ຮ້ານຂາຍເຄື່ອງ',
        storeAddress: settings.storeAddress || '',
        storePhone: settings.storePhone || '',
        orderId: order.id,
        date: new Date(order.created_at),
        paymentMethod: order.payment_method,
        items: order.order_items?.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.price })) ?? [],
        total: order.total,
        received: order.received,
        change: order.change,
      }, settings);
      setPrinting(false);
      if (result.success) { onClose(); return; }
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
