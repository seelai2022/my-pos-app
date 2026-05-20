'use client';

import { useState } from 'react';
import { type Product, type ProductUnit } from '@/lib/supabase';
import BarcodeScanner from './BarcodeScanner';

interface CartItem {
  productId: string;
  unitId: string | null;
  name: string;
  unitName: string | null;
  price: number;
  quantity: number;
}

interface ProductGridProps {
  products: Product[];
  onAdd: (item: CartItem) => void;
}

export default function ProductGrid({ products, onAdd }: ProductGridProps) {
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleProductClick = (product: Product) => {
    if (product.stock === 0) return;
    if (product.product_units && product.product_units.length > 0) {
      setSelectedProduct(product);
    } else {
      onAdd({ productId: product.id, unitId: null, name: product.name, unitName: null, price: product.price, quantity: 1 });
    }
  };

  const handleUnitSelect = (product: Product, unit: ProductUnit) => {
    onAdd({ productId: product.id, unitId: unit.id, name: product.name, unitName: unit.name, price: unit.price, quantity: 1 });
    setSelectedProduct(null);
  };

  const handleDefaultSelect = (product: Product) => {
    onAdd({ productId: product.id, unitId: null, name: product.name, unitName: null, price: product.price, quantity: 1 });
    setSelectedProduct(null);
  };

  const handleScanned = (code: string) => {
    setShowScanner(false);
    const product = products.find((p) => p.barcode === code);
    if (product) { handleProductClick(product); return; }
    for (const p of products) {
      const unit = p.product_units?.find((u) => u.barcode === code);
      if (unit) {
        onAdd({ productId: p.id, unitId: unit.id, name: p.name, unitName: unit.name, price: unit.price, quantity: 1 });
        return;
      }
    }
    alert(`ບໍ່ພົບສິນຄ້າ: ${code}`);
  };

  return (
    <>
      <div className="flex flex-col w-full h-full overflow-hidden">

        {/* Search + Scan */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-1 shadow-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input type="text" placeholder="ຄົ້ນຫາສິນຄ້າ..." value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"/>
          </div>
          <button onClick={() => setShowScanner(true)}
            className="w-11 h-11 bg-gray-900 text-white rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 0 2 2h4M21 9V5a2 2 0 0 0-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4"/>
            </svg>
          </button>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <div key={product.id}
                onClick={() => handleProductClick(product)}
                className={`bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm transition-all active:scale-[0.97]
                  ${product.stock === 0 ? 'opacity-50' : 'cursor-pointer hover:border-gray-300'}`}>

                {/* Image / Emoji */}
                <div className="relative bg-gray-50 overflow-hidden" style={{ height: '120px' }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-4xl select-none">{product.emoji}</span>
                    )}
                  </div>
                  {product.product_units && product.product_units.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {product.product_units.length + 1} unit
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-800 leading-tight mb-0.5 line-clamp-2">{product.name}</p>
                  <p className="text-xs text-blue-600 font-medium">{product.price.toLocaleString()} ₭</p>
                  {product.stock > 0 && product.stock <= 10 && (
                    <p className="text-xs text-amber-500">ເຫຼືອ {product.stock}</p>
                  )}
                  {product.stock === 0 && (
                    <p className="text-xs text-red-400">ໝົດສາງ</p>
                  )}
                  <button
                    disabled={product.stock === 0}
                    onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                    className="mt-1.5 w-full text-xs font-medium py-1.5 rounded-lg bg-gray-900 text-white
                               disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
                    + ເພີ່ມ
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-sm text-gray-400 py-12">ບໍ່ພົບສິນຄ້າ</p>
            )}
          </div>
        </div>
      </div>

      {/* Unit Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                  {selectedProduct.image_url ? (
                    <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover"/>
                  ) : (
                    <span className="text-2xl">{selectedProduct.emoji}</span>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-gray-800">{selectedProduct.name}</h2>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-2">ເລືອກ unit</p>
              <button onClick={() => handleDefaultSelect(selectedProduct)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-900 active:bg-gray-50 transition-all">
                <span className="text-sm font-medium text-gray-700">ອັນ (ດີຟໍລ)</span>
                <span className="text-sm font-semibold text-gray-900">{selectedProduct.price.toLocaleString()} ₭</span>
              </button>
              {selectedProduct.product_units?.map((unit) => (
                <button key={unit.id} onClick={() => handleUnitSelect(selectedProduct, unit)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-900 active:bg-gray-50 transition-all">
                  <span className="text-sm font-medium text-gray-700">{unit.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{unit.price.toLocaleString()} ₭</span>
                </button>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setSelectedProduct(null)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
                ຍົກເລີກ
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onScanned={handleScanned} onClose={() => setShowScanner(false)}/>
      )}
    </>
  );
}
