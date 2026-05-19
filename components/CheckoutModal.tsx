'use client';

import { useState, useEffect } from 'react';
import { supabase, type Product, type Promotion, type Order } from '@/lib/supabase';
import { type VATSettings } from '@/lib/vat';
import { useAuth } from '@/context/AuthContext';
import PrintModal from './PrintModal';

interface CartItem {
  productId: string;
  unitId: string | null;
  name: string;
  unitName: string | null;
  price: number;
  quantity: number;
}

interface CheckoutModalProps {
  total: number;
  subtotal: number;
  discount: number;
  manualDiscount: number;
  manualDiscountType: 'percent' | 'fixed';
  manualDiscountValue: number;
  promoDiscount: number;
  vatAmount: number;
  vatSettings: VATSettings;
  promotion: Promotion | null;
  cart: CartItem[];
  products: Product[];
  onConfirm: () => void;
  onClose: () => void;
}

type PaymentMethod = 'cash' | 'qr' | 'card';

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'ເງິນສົດ' },
  { id: 'qr',   label: 'QR Code' },
  { id: 'card', label: 'ບັດ' },
];

export default function CheckoutModal({
  total, subtotal, discount, manualDiscount, manualDiscountType, manualDiscountValue,
  promoDiscount, vatAmount, vatSettings, promotion, cart, products, onConfirm, onClose
}: CheckoutModalProps) {
  const { staff } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [received, setReceived] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const receivedNum = parseFloat(received) || 0;
  const change = receivedNum - total;
  const isEnough = method !== 'cash' || receivedNum >= total;

  const quickAmounts = [...new Set([
    total,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
  ])].slice(0, 4);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showPrint) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showPrint]);

  useEffect(() => { setReceived(''); setErrorMsg(null); }, [method]);

  const handleConfirm = async () => {
    if (!isEnough || saving) return;
    setSaving(true); setErrorMsg(null);
    try {
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        total, discount,
        payment_method: method,
        received: method === 'cash' ? receivedNum : null,
        change: method === 'cash' ? change : null,
        staff_id: staff?.id ?? null,
        promotion_id: promotion?.id ?? null,
      }).select().single();

      if (orderError) { setErrorMsg(orderError.message); setSaving(false); return; }
      if (order) {
        const items = cart.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          product_name: item.unitName ? `${item.name} (${item.unitName})` : item.name,
          price: item.price,
          quantity: item.quantity,
        }));
        const { error: itemsError } = await supabase.from('order_items').insert(items);
        if (itemsError) { setErrorMsg(itemsError.message); setSaving(false); return; }
        const { data: fullOrder } = await supabase.from('orders').select('*, order_items(*)').eq('id', order.id).single();
        setCompletedOrder(fullOrder);
      }
      setConfirmed(true);
    } catch { setErrorMsg('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່'); setSaving(false); }
  };

  if (showPrint && completedOrder) {
    return <PrintModal order={completedOrder} onClose={() => { setShowPrint(false); onConfirm(); }}/>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Success */}
        {confirmed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white gap-3 px-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p className="text-base font-medium text-gray-800">ຊຳລະເງິນສຳເລັດ</p>
            {staff && <p className="text-xs text-gray-400">ໂດຍ: {staff.name}</p>}
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => onConfirm()}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">ຂ້າມ</button>
              <button onClick={() => setShowPrint(true)}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
                </svg>
                ພິມ
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-medium text-gray-800">ຊຳລະເງິນ</h2>
            {staff && <p className="text-xs text-gray-400 mt-0.5">👤 {staff.name}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {errorMsg && <div className="bg-red-50 text-red-500 text-xs px-4 py-2.5 rounded-xl">❌ {errorMsg}</div>}

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>ລາຄາກ່ອນຫຼຸດ</span><span>{subtotal.toLocaleString()} ₭</span>
            </div>
            {manualDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>ສ່ວນຫຼຸດ ({manualDiscountType === 'percent' ? `${manualDiscountValue}%` : 'LAK'})</span>
                <span>-{manualDiscount.toLocaleString()} ₭</span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>ໂປໂມ {promotion?.code}</span>
                <span>-{promoDiscount.toLocaleString()} ₭</span>
              </div>
            )}
            {vatSettings.enabled && vatAmount > 0 && (
              <div className="flex justify-between text-sm text-blue-600">
                <span>VAT {vatSettings.rate}% ({vatSettings.mode === 'inclusive' ? 'ລວມຢູ່ແລ້ວ' : 'ບວກເພີ່ມ'})</span>
                <span>{vatSettings.mode === 'exclusive' ? '+' : ''}{vatAmount.toLocaleString()} ₭</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>ລວມທັງໝົດ</span>
              <span className="text-xl">{total.toLocaleString()} ₭</span>
            </div>
          </div>

          {/* Method */}
          <div>
            <p className="text-xs text-gray-400 mb-2">ວິທີຊຳລະ</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${method === m.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {method === 'cash' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ຈຳນວນເງິນທີ່ຮັບມາ</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-gray-400">
                  <input type="number" min={0} placeholder="0" value={received}
                    onChange={(e) => setReceived(e.target.value)} autoFocus
                    className="flex-1 outline-none text-lg font-medium text-gray-800 bg-transparent placeholder-gray-300"/>
                  <span className="text-gray-400 text-sm shrink-0">₭</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {quickAmounts.map((amt) => (
                  <button key={amt} onClick={() => setReceived(String(amt))}
                    className="py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                    {(amt/1000).toLocaleString()}K
                  </button>
                ))}
              </div>
              <div className={`rounded-xl px-4 py-3 flex justify-between items-center
                ${received === '' ? 'bg-gray-50' : receivedNum >= total ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className={`text-sm ${received === '' ? 'text-gray-400' : receivedNum >= total ? 'text-green-600' : 'text-red-500'}`}>
                  ເງິນທອນ
                </span>
                <span className={`text-xl font-semibold ${received === '' ? 'text-gray-300' : receivedNum >= total ? 'text-green-600' : 'text-red-500'}`}>
                  {received === '' ? '— ₭' : receivedNum >= total ? `${change.toLocaleString()} ₭` : `ຂາດ ${Math.abs(change).toLocaleString()} ₭`}
                </span>
              </div>
            </div>
          )}

          {method === 'qr' && (
            <div className="flex flex-col items-center gap-3 py-1">
              <div className="w-44 h-44 bg-white border-2 border-gray-200 rounded-xl p-3">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <rect x="5" y="5" width="28" height="28" rx="3" fill="#111"/><rect x="9" y="9" width="20" height="20" rx="2" fill="white"/><rect x="13" y="13" width="12" height="12" rx="1" fill="#111"/>
                  <rect x="67" y="5" width="28" height="28" rx="3" fill="#111"/><rect x="71" y="9" width="20" height="20" rx="2" fill="white"/><rect x="75" y="13" width="12" height="12" rx="1" fill="#111"/>
                  <rect x="5" y="67" width="28" height="28" rx="3" fill="#111"/><rect x="9" y="71" width="20" height="20" rx="2" fill="white"/><rect x="13" y="75" width="12" height="12" rx="1" fill="#111"/>
                  {[40,46,52,58,40,52,40,46,58,44,50,56,42,54,48].map((x,i)=>(
                    <rect key={i} x={x} y={38+(i%6)*7} width="4" height="4" rx="0.5" fill="#111"/>
                  ))}
                </svg>
              </div>
              <div className="w-full bg-blue-50 rounded-xl px-4 py-2.5 flex justify-between">
                <span className="text-xs text-blue-400">ຍອດທີ່ຕ້ອງຊຳລະ</span>
                <span className="text-lg font-semibold text-blue-600">{total.toLocaleString()} ₭</span>
              </div>
            </div>
          )}

          {method === 'card' && (
            <div className="space-y-3 py-1">
              <div className="bg-gray-900 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8"/>
                <p className="text-xs text-white/40 mb-4">VISA / MASTERCARD</p>
                <p className="text-sm font-mono tracking-widest opacity-60">•••• •••• •••• 1234</p>
              </div>
              <div className="bg-purple-50 rounded-xl px-4 py-2.5 flex justify-between">
                <span className="text-xs text-purple-400">ຍອດທີ່ຕ້ອງຊຳລະ</span>
                <span className="text-lg font-semibold text-purple-600">{total.toLocaleString()} ₭</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            ຍົກເລີກ
          </button>
          <button onClick={handleConfirm} disabled={!isEnough || saving}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            {saving ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນຊຳລະ'}
          </button>
        </div>
      </div>
    </div>
  );
}
