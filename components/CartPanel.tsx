'use client';

import { useState, useEffect } from 'react';
import { type Product, type Promotion, supabase, calcDiscount } from '@/lib/supabase';
import { loadVATSettings, calcVAT } from '@/lib/vat';
import CheckoutModal from './CheckoutModal';

interface CartItem {
  productId: string;
  unitId: string | null;
  name: string;
  unitName: string | null;
  price: number;
  quantity: number;
}

interface HeldOrder {
  id: string;
  label: string;
  cart: CartItem[];
  createdAt: Date;
}

interface CartPanelProps {
  products: Product[];
  cart: CartItem[];
  onChangeQty: (key: string, delta: number) => void;
  onClear: () => void;
  onHold: (label?: string) => void;
  heldOrders: HeldOrder[];
  onResume: (held: HeldOrder) => void;
  onDeleteHeld: (id: string) => void;
  showHeldPanel: boolean;
  onToggleHeldPanel: () => void;
  onMobileClose?: () => void;
  isMobile?: boolean;
}

export function cartKey(item: CartItem) {
  return `${item.productId}__${item.unitId ?? 'default'}`;
}

type DiscountTab = 'manual' | 'promo';
type ManualDiscountType = 'percent' | 'fixed';

export default function CartPanel({
  products, cart, onChangeQty, onClear,
  onHold, heldOrders, onResume, onDeleteHeld,
  showHeldPanel, onToggleHeldPanel,
  onMobileClose, isMobile,
}: CartPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [showHoldInput, setShowHoldInput] = useState(false);
  const [holdLabel, setHoldLabel] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [discountTab, setDiscountTab] = useState<DiscountTab>('manual');
  const [manualType, setManualType] = useState<ManualDiscountType>('percent');
  const [manualValue, setManualValue] = useState('');
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const vatSettings = loadVATSettings();

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isEmpty = cart.length === 0;

  const manualDiscountAmount = (() => {
    const v = parseFloat(manualValue) || 0;
    if (!v) return 0;
    if (manualType === 'percent') return Math.min(Math.round(subtotal * v / 100), subtotal);
    return Math.min(v, subtotal);
  })();

  const promoDiscountAmount = calcDiscount(appliedPromo, subtotal);
  const totalDiscount = manualDiscountAmount + promoDiscountAmount;
  const subtotalAfterDiscount = Math.max(subtotal - totalDiscount, 0);
  const { vatAmount, grandTotal } = calcVAT(subtotalAfterDiscount, vatSettings);

  useEffect(() => {
    if (isEmpty) { setAppliedPromo(null); setPromoCode(''); setPromoError(''); setManualValue(''); setShowDiscountPanel(false); }
  }, [isEmpty]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true); setPromoError('');
    const { data } = await supabase.from('promotions').select('*').eq('code', promoCode.trim().toUpperCase()).eq('active', true).single();
    if (!data) { setPromoError('ໂຄດບໍ່ຖືກຕ້ອງ'); setAppliedPromo(null); }
    else if (subtotal < data.min_amount) { setPromoError(`ຕ້ອງຊື້ຂັ້ນຕ່ຳ ${data.min_amount.toLocaleString()} ₭`); setAppliedPromo(null); }
    else { setAppliedPromo(data); setPromoError(''); }
    setPromoLoading(false);
  };

  const handleHold = () => {
    if (isEmpty) return;
    if (showHoldInput) { onHold(holdLabel || `ບິນ ${heldOrders.length + 1}`); setHoldLabel(''); setShowHoldInput(false); }
    else setShowHoldInput(true);
  };

  return (
    <>
      <div className="flex flex-col h-full w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile back button */}
            {isMobile && (
              <button onClick={onMobileClose} className="mr-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            )}
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">ກະຕ່າ</span>
            {totalQty > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">{totalQty}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onToggleHeldPanel}
              className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all
                ${showHeldPanel ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
              Hold
              {heldOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {heldOrders.length}
                </span>
              )}
            </button>
            {!isEmpty && <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-400">ລ້າງ</button>}
          </div>
        </div>

        {/* Held orders */}
        {showHeldPanel && (
          <div className="border-b border-gray-100 bg-amber-50/50 shrink-0">
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-amber-700 mb-2">Hold ({heldOrders.length})</p>
              {heldOrders.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">ຍັງບໍ່ມີ</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {heldOrders.map((held) => (
                    <div key={held.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-amber-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{held.label}</p>
                        <p className="text-xs text-gray-400">{held.cart.reduce((s,i) => s+i.price*i.quantity,0).toLocaleString()} ₭</p>
                      </div>
                      <button onClick={() => onResume(held)} className="text-xs text-blue-500 font-medium shrink-0">Resume</button>
                      <button onClick={() => onDeleteHeld(held.id)} className="text-xs text-red-400 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M10 19a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm7 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/>
              </svg>
              <p className="text-sm">ຍັງບໍ່ມີສິນຄ້າ</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                const key = cartKey(item);
                return (
                  <li key={key} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                      {product?.image_url ? <img src={product.image_url} alt={item.name} className="w-full h-full object-cover"/> : <span className="text-xl">{product?.emoji ?? '🛍️'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      {item.unitName && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{item.unitName}</span>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.price.toLocaleString()} ₭ × {item.quantity} = <span className="text-gray-600 font-medium">{(item.price*item.quantity).toLocaleString()} ₭</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => onChangeQty(key, -1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-base leading-none">−</button>
                      <span className="w-5 text-center text-sm font-medium text-gray-800">{item.quantity}</span>
                      <button onClick={() => onChangeQty(key, 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-base leading-none">+</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Discount */}
        {!isEmpty && (
          <div className="px-4 py-3 border-t border-gray-50 space-y-2 shrink-0">
            <button onClick={() => setShowDiscountPanel(!showDiscountPanel)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z"/>
                </svg>
                ສ່ວນຫຼຸດ
                {totalDiscount > 0 && <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">-{totalDiscount.toLocaleString()} ₭</span>}
              </span>
              <svg className={`w-3.5 h-3.5 transition-transform ${showDiscountPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {showDiscountPanel && (
              <div className="space-y-2">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  <button onClick={() => setDiscountTab('manual')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${discountTab === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>ດ້ວຍຕົນເອງ</button>
                  <button onClick={() => setDiscountTab('promo')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${discountTab === 'promo' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>Promo Code</button>
                </div>
                {discountTab === 'manual' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => { setManualType('percent'); setManualValue(''); }} className={`py-2 rounded-xl border text-xs font-medium transition-all ${manualType === 'percent' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>% ສ່ວນຫຼຸດ</button>
                      <button onClick={() => { setManualType('fixed'); setManualValue(''); }} className={`py-2 rounded-xl border text-xs font-medium transition-all ${manualType === 'fixed' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>₭ LAK</button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 py-2 focus-within:border-gray-400">
                        <input type="number" min={0} placeholder="0" value={manualValue} onChange={e => setManualValue(e.target.value)} className="flex-1 outline-none text-sm font-medium text-gray-800 bg-transparent placeholder-gray-300"/>
                        <span className="text-xs text-gray-400 ml-1">{manualType === 'percent' ? '%' : '₭'}</span>
                      </div>
                      {manualValue && <button onClick={() => setManualValue('')} className="px-3 border border-gray-200 rounded-xl text-gray-400 hover:text-red-400 text-xs">✕</button>}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(manualType === 'percent' ? [5,10,15,20] : [5000,10000,20000,50000]).map(v => (
                        <button key={v} onClick={() => setManualValue(String(v))}
                          className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${manualValue === String(v) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {manualType === 'percent' ? `${v}%` : `${v/1000}K`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {discountTab === 'promo' && (
                  appliedPromo ? (
                    <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2.5">
                      <div><p className="text-xs font-medium text-green-700">{appliedPromo.name}</p><p className="text-xs text-green-500 font-mono">{appliedPromo.code}</p></div>
                      <div className="text-right"><p className="text-sm font-semibold text-green-700">-{promoDiscountAmount.toLocaleString()} ₭</p><button onClick={() => { setAppliedPromo(null); setPromoCode(''); }} className="text-xs text-red-400">ລຶບ</button></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') handleApplyPromo(); }} placeholder="Promo Code..."
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-gray-400"/>
                        <button onClick={handleApplyPromo} disabled={promoLoading || !promoCode} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-xl hover:bg-gray-700 disabled:opacity-30">ໃຊ້</button>
                      </div>
                      {promoError && <p className="text-xs text-red-500">{promoError}</p>}
                    </>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Hold input */}
        {showHoldInput && !isEmpty && (
          <div className="px-4 pb-3 shrink-0">
            <div className="flex gap-2">
              <input type="text" value={holdLabel} onChange={e => setHoldLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleHold(); if (e.key === 'Escape') { setShowHoldInput(false); setHoldLabel(''); } }}
                placeholder="ຊື່ບິນ (ໂຕະ 1, ລູກຄ້າ A...)" autoFocus
                className="flex-1 border border-amber-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 bg-amber-50"/>
              <button onClick={() => { setShowHoldInput(false); setHoldLabel(''); }} className="px-2 text-gray-400 text-xs">✕</button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-1.5 shrink-0 pb-safe"
          style={{ paddingBottom: isMobile ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : undefined }}>
          {totalDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>ສ່ວນຫຼຸດ</span><span>-{totalDiscount.toLocaleString()} ₭</span></div>}
          {vatSettings.enabled && vatAmount > 0 && (
            <div className="flex justify-between text-sm text-blue-600">
              <span>VAT {vatSettings.rate}%</span><span>{vatSettings.mode === 'exclusive' ? '+' : ''}{vatAmount.toLocaleString()} ₭</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="text-base font-medium text-gray-700">ລວມທັງໝົດ</span>
            <span className="text-base font-semibold text-gray-900">{grandTotal.toLocaleString()} ₭</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button disabled={isEmpty} onClick={handleHold}
              className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all
                ${showHoldInput ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 disabled:opacity-30 disabled:cursor-not-allowed'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
              {showHoldInput ? 'ຢືນຢັນ' : 'Hold'}
            </button>
            <button disabled={isEmpty} onClick={() => setShowModal(true)}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z"/>
              </svg>
              ຊຳລະ
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <CheckoutModal
          total={grandTotal} subtotal={subtotal} discount={totalDiscount}
          manualDiscount={manualDiscountAmount} manualDiscountType={manualType}
          manualDiscountValue={parseFloat(manualValue) || 0}
          promoDiscount={promoDiscountAmount} vatAmount={vatAmount} vatSettings={vatSettings}
          promotion={appliedPromo} cart={cart} products={products}
          onConfirm={() => { setShowModal(false); setAppliedPromo(null); setPromoCode(''); setManualValue(''); setShowDiscountPanel(false); onClear(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
