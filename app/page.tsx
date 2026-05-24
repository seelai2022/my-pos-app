'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type Product } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import CartPanel, { cartKey } from '@/components/CartPanel';
import ProductGrid from '@/components/ProductGrid';
import LoginModal from '@/components/LoginModal';

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

export default function POSPage() {
  const { staff } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldPanel, setShowHeldPanel] = useState(false);
  // Mobile: 'products' or 'cart'
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  const barcodeInputRef = useRef<string>('');
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*, product_units(*, units(*))').order('name');
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_held_orders');
      if (saved) setHeldOrders(JSON.parse(saved).map((o: HeldOrder) => ({ ...o, createdAt: new Date(o.createdAt) })));
    } catch {}
  }, []);

  const saveHeldOrders = (orders: HeldOrder[]) => {
    setHeldOrders(orders);
    localStorage.setItem('pos_held_orders', JSON.stringify(orders));
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        const code = barcodeInputRef.current.trim(); barcodeInputRef.current = '';
        if (code.length > 4) {
          const product = products.find((p) => p.barcode === code);
          if (product) { addToCart({ productId: product.id, unitId: null, name: product.name, unitName: null, price: product.price, quantity: 1 }); return; }
          for (const p of products) {
            const unit = p.product_units?.find((u) => u.barcode === code);
            if (unit) { addToCart({ productId: p.id, unitId: unit.id, name: p.name, unitName: unit.name, price: unit.price, quantity: 1 }); return; }
          }
        }
      } else if (e.key.length === 1) {
        barcodeInputRef.current += e.key;
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => { barcodeInputRef.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [products]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const key = cartKey(item);
      const existing = prev.find((i) => cartKey(i) === key);
      if (existing) return prev.map((i) => cartKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) => prev.map((i) => cartKey(i) === key ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  };

  const changePrice = (key: string, price: number) => {
    setCart((prev) => prev.map((i) => cartKey(i) === key ? { ...i, price: Math.max(0, price) } : i));
  };

  const clearCart = () => { setCart([]); setMobileView('products'); };

  const holdOrder = (label?: string) => {
    if (cart.length === 0) return;
    const newHeld: HeldOrder = { id: Date.now().toString(), label: label || `ບິນ ${heldOrders.length + 1}`, cart: [...cart], createdAt: new Date() };
    saveHeldOrders([...heldOrders, newHeld]);
    setCart([]); setShowHeldPanel(false); setMobileView('products');
  };

  const resumeOrder = (held: HeldOrder) => {
    if (cart.length > 0 && !confirm('ກະຕ່າປັດຈຸບັນຈະຖືກລ້າງ — Resume ບໍ?')) return;
    setCart(held.cart);
    saveHeldOrders(heldOrders.filter((o) => o.id !== held.id));
    setShowHeldPanel(false);
  };

  const deleteHeldOrder = (id: string) => saveHeldOrders(heldOrders.filter((o) => o.id !== id));
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);

  if (!staff) return <LoginModal />;
  if (loading) return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 text-gray-400 text-sm">
      ກຳລັງໂຫລດ...
    </div>
  );

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden relative">

      {/* ── Desktop: side by side ── */}
      <div className="hidden md:flex flex-1 min-w-0 overflow-hidden">
        <ProductGrid products={products} onAdd={addToCart} />
      </div>
      <div className="hidden md:flex w-80 shrink-0 bg-white border-l border-gray-100">
        <CartPanel
          products={products} cart={cart}
          onChangeQty={changeQty} onChangePrice={changePrice} onClear={clearCart}
          onHold={holdOrder} heldOrders={heldOrders}
          onResume={resumeOrder} onDeleteHeld={deleteHeldOrder}
          showHeldPanel={showHeldPanel}
          onToggleHeldPanel={() => setShowHeldPanel(!showHeldPanel)}
        />
      </div>

      {/* ── Mobile: toggle between products and cart ── */}
      <div className="md:hidden flex flex-1 min-w-0 overflow-hidden flex-col">
        {mobileView === 'products' ? (
          <>
            <ProductGrid products={products} onAdd={(item) => { addToCart(item); }} />
            {/* Mobile cart button */}
            <button
              onClick={() => setMobileView('cart')}
              className="fixed z-20 bg-gray-900 text-white shadow-xl flex items-center gap-2 active:scale-95 transition-all rounded-2xl px-4"
              style={{ height: 52, bottom: 72, right: 16 }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M10 19a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm7 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/>
              </svg>
              <span className="text-sm font-semibold">ກະຕ່າ</span>
              {totalQty > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {totalQty}
                </span>
              )}
            </button>
          </>
        ) : (
          /* Full screen cart on mobile */
          <div className="flex flex-col flex-1 overflow-hidden bg-white">
            {/* Back button */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
              <button onClick={() => setMobileView('products')}
                className="flex items-center gap-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
                <span className="text-sm font-medium">ກັບ</span>
              </button>
              <span className="text-base font-semibold text-gray-800 flex-1 text-center">ກະຕ່າ</span>
              <div className="w-12"/>
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel
                products={products} cart={cart}
                onChangeQty={changeQty} onChangePrice={changePrice} onClear={clearCart}
                onHold={holdOrder} heldOrders={heldOrders}
                onResume={resumeOrder} onDeleteHeld={deleteHeldOrder}
                showHeldPanel={showHeldPanel}
                onToggleHeldPanel={() => setShowHeldPanel(!showHeldPanel)}
                onMobileClose={() => setMobileView('products')}
                isMobile
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
