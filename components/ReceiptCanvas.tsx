'use client';

import { useEffect, useRef } from 'react';
import { type Order } from '@/lib/supabase';

interface ReceiptCanvasProps {
  order: Order;
  onReady?: (canvas: HTMLCanvasElement) => void;
}

const PAPER_WIDTH = 576;
const FONT = '14px "Noto Sans Lao", "Noto Sans", Arial, sans-serif';
const FONT_BOLD = 'bold 16px "Noto Sans Lao", "Noto Sans", Arial, sans-serif';
const FONT_LARGE = 'bold 20px "Noto Sans Lao", "Noto Sans", Arial, sans-serif';
const FONT_SMALL = '12px "Noto Sans Lao", "Noto Sans", Arial, sans-serif';

const METHOD_LABEL: Record<string, string> = {
  cash: 'ເງິນສົດ', qr: 'QR Code', card: 'ບັດ'
};

export default function ReceiptCanvas({ order, onReady }: ReceiptCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const items = order.order_items ?? [];

    // Calculate height
    const lineH = 24;
    const headerH = 120;
    const itemH = items.length * lineH * 2 + 20;
    const footerH = 160;
    const totalH = headerH + itemH + footerH;

    canvas.width = PAPER_WIDTH;
    canvas.height = totalH;

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PAPER_WIDTH, totalH);

    ctx.fillStyle = '#000';
    let y = 20;

    const settings = (() => {
      try { return JSON.parse(localStorage.getItem('pos_settings') || '{}'); } catch { return {}; }
    })();

    const storeName = settings.storeName || 'KL Shop';
    const storeAddress = settings.storeAddress || '';
    const storePhone = settings.storePhone || '';

    // Store name
    ctx.font = FONT_LARGE;
    ctx.textAlign = 'center';
    ctx.fillText(storeName, PAPER_WIDTH / 2, y); y += 28;

    ctx.font = FONT;
    if (storeAddress) { ctx.fillText(storeAddress, PAPER_WIDTH / 2, y); y += 22; }
    if (storePhone) { ctx.fillText(storePhone, PAPER_WIDTH / 2, y); y += 22; }

    // Dashed line
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(PAPER_WIDTH - 10, y); ctx.stroke();
    y += 16;

    // Order info
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.setLineDash([]);
    const date = new Date(order.created_at);
    ctx.fillText(`ບິນ: #${order.id.slice(-8).toUpperCase()}`, 10, y); y += 22;
    ctx.fillText(`ວັນທີ: ${date.toLocaleDateString('lo-LA')}`, 10, y); y += 22;
    ctx.fillText(`ເວລາ: ${date.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}`, 10, y); y += 22;
    ctx.fillText(`ຊຳລະ: ${METHOD_LABEL[order.payment_method] ?? order.payment_method}`, 10, y); y += 22;

    // Dashed line
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(PAPER_WIDTH - 10, y); ctx.stroke();
    y += 16; ctx.setLineDash([]);

    // Items
    for (const item of items) {
      ctx.font = FONT;
      ctx.textAlign = 'left';
      const name = item.product_name.length > 24 ? item.product_name.slice(0, 24) + '...' : item.product_name;
      ctx.fillText(name, 10, y); y += 22;
      ctx.font = FONT_SMALL;
      ctx.fillText(`  ${item.price.toLocaleString()} x ${item.quantity}`, 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${(item.price * item.quantity).toLocaleString()} ₭`, PAPER_WIDTH - 10, y);
      y += 22;
    }

    // Dashed line
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(PAPER_WIDTH - 10, y); ctx.stroke();
    y += 16; ctx.setLineDash([]);

    // Total
    ctx.font = FONT_BOLD;
    ctx.textAlign = 'left';
    ctx.fillText('ລວມທັງໝົດ', 10, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${order.total.toLocaleString()} ₭`, PAPER_WIDTH - 10, y);
    y += 26;

    if (order.payment_method === 'cash' && order.received) {
      ctx.font = FONT;
      ctx.textAlign = 'left';
      ctx.fillText('ຮັບມາ', 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${order.received.toLocaleString()} ₭`, PAPER_WIDTH - 10, y);
      y += 22;
      ctx.textAlign = 'left';
      ctx.fillText('ເງິນທອນ', 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${(order.change ?? 0).toLocaleString()} ₭`, PAPER_WIDTH - 10, y);
      y += 22;
    }

    // Dashed line
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(PAPER_WIDTH - 10, y); ctx.stroke();
    y += 16; ctx.setLineDash([]);

    // Thank you
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.fillText('ຂອບໃຈທີ່ໃຊ້ບໍລິການ', PAPER_WIDTH / 2, y);

    if (onReady) onReady(canvas);
  }, [order, onReady]);

  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
}
