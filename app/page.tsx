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
  const [showMobileCart, setShowMobileCart] = useState(false);
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

  const clearCart = () => { setCart([]); setShowMobileCart(false); };

  const holdOrder = (label?: string) => {
    if (cart.length === 0) return;
    const newHeld: HeldOrder = { id: Date.now().toString(), label: label || `ບິນ ${heldOrders.length + 1}`, cart: [...cart], createdAt: new Date() };
    saveHeldOrders([...heldOrders, newHeld]);
    setCart([]); setShowHeldPanel(false); setShowMobileCart(false);
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
    <div className="flex flex-1 items-center justify-center bg-gray-50 text-gray-400 text-sm pb-16 md:pb-0">
      ກຳລັງໂຫລດ...
    </div>
  );

  return (
    <div className="flex flex-1 min-w-0 bg-gray-50 overflow-hidden relative">

      {/* Product Grid — always full width on mobile */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <ProductGrid products={products} onAdd={addToCart} />
      </div>

      {/* Desktop Cart — fixed right panel */}
      <div className="hidden md:flex w-80 shrink-0 bg-white border-l border-gray-100 overflow-hidden">
        <CartPanel
          products={products} cart={cart}
          onChangeQty={changeQty} onClear={clearCart}
          onHold={holdOrder} heldOrders={heldOrders}
          onResume={resumeOrder} onDeleteHeld={deleteHeldOrder}
          showHeldPanel={showHeldPanel}
          onToggleHeldPanel={() => setShowHeldPanel(!showHeldPanel)}
        />
      </div>

      {/* Mobile Cart — bottom sheet */}
      {showMobileCart && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col">
          {/* Backdrop */}
          <div className="flex-1 bg-black/30" onClick={() => setShowMobileCart(false)}/>
          {/* Sheet */}
          <div className="bg-white rounded-t-3xl shadow-2xl h-[85vh] flex flex-col overflow-hidden">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full"/>
            </div>
            <CartPanel
              products={products} cart={cart}
              onChangeQty={changeQty} onClear={clearCart}
              onHold={holdOrder} heldOrders={heldOrders}
              onResume={resumeOrder} onDeleteHeld={deleteHeldOrder}
              showHeldPanel={showHeldPanel}
              onToggleHeldPanel={() => setShowHeldPanel(!showHeldPanel)}
              onMobileClose={() => setShowMobileCart(false)}
              isMobile
            />
          </div>
        </div>
      )}

      {/* Mobile FAB — floating cart button */}
      <button
        onClick={() => setShowMobileCart(true)}
        className="md:hidden fixed bottom-20 right-4 z-20 w-14 h-14 bg-gray-900 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-95 transition-all">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M10 19a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm7 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/>
        </svg>
        {totalQty > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {totalQty}
          </span>
        )}
      </button>
    </div>
  );
}
