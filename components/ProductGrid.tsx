'use client';

import { useState } from 'react';
import { type Product, type ProductUnit } from '@/lib/supabase';

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

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleProductClick = (product: Product) => {
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

  return (
    <>
      <div className="flex flex-col flex-1 min-w-0 p-5 overflow-hidden">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4 shadow-sm">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input type="text" placeholder="ຄົ້ນຫາສິນຄ້າ..." value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"/>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pb-2">
          {filtered.map((product) => (
            <div key={product.id} onClick={() => handleProductClick(product)}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer
                         hover:border-gray-300 hover:-translate-y-0.5 active:scale-[0.98]
                         transition-all duration-150 shadow-sm">

              {/* Image or Emoji */}
              <div className="h-28 relative bg-gray-50 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl select-none">
                    {product.emoji}
                  </div>
                )}

                {/* Unit badge */}
                {product.product_units && product.product_units.length > 0 && (
                  <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-sm">
                    {product.product_units.length + 1} unit
                  </span>
                )}
              </div>

              <div className="p-3">
                <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{product.price.toLocaleString()} ₭</p>
                {product.stock <= 10 && product.stock > 0 && (
                  <p className="text-xs text-amber-500 mt-0.5">ເຫຼືອ {product.stock}</p>
                )}
                {product.stock === 0 && (
                  <p className="text-xs text-red-400 mt-0.5">ໝົດສາງ</p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                  disabled={product.stock === 0}
                  className="mt-2 w-full text-xs font-medium py-1.5 rounded-lg
                             bg-blue-50 text-blue-600 hover:bg-blue-100
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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

      {/* Unit selection modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {/* Product image/emoji in modal */}
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                  {selectedProduct.image_url ? (
                    <img src={selectedProduct.image_url} alt={selectedProduct.name}
                      className="w-full h-full object-cover"/>
                  ) : (
                    <span className="text-2xl">{selectedProduct.emoji}</span>
                  )}
                </div>
                <h2 className="text-base font-medium text-gray-800">{selectedProduct.name}</h2>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-3">ເລືອກ unit</p>
              <button onClick={() => handleDefaultSelect(selectedProduct)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all">
                <span className="text-sm font-medium text-gray-700">ອັນ (ດີຟໍລ)</span>
                <span className="text-sm font-semibold text-gray-900">{selectedProduct.price.toLocaleString()} ₭</span>
              </button>
              {selectedProduct.product_units?.map((unit) => (
                <button key={unit.id} onClick={() => handleUnitSelect(selectedProduct, unit)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all">
                  <span className="text-sm font-medium text-gray-700">{unit.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{unit.price.toLocaleString()} ₭</span>
                </button>
              ))}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => setSelectedProduct(null)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
                ຍົກເລີກ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
