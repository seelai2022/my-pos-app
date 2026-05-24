'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, uploadProductImage, deleteProductImage, type Product, type Unit } from '@/lib/supabase';
import { exportProductsToExcel, parseProductsFromExcel, type ImportedProduct, type ImportResult } from '@/lib/excel';
import BarcodeScanner from '@/components/BarcodeScanner';

const EMOJI_OPTIONS = ['☕','🍵','🍰','🥪','🍊','🍪','🍕','🍜','🥤','🍱','🧃','🍫'];
const emptyForm = { name: '', price: '', emoji: '🛍️', barcode: '', stock: '' };

interface UnitRow { unit_id: string; price: string; barcode: string; }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBarcodeSheet, setShowBarcodeSheet] = useState(false);
  const [barcodeProducts, setBarcodeProducts] = useState<Product[]>([]);
  const [labelsPerItem, setLabelsPerItem] = useState(1);
  const [scanTarget, setScanTarget] = useState<'form' | number | null>(null);
  const [showUnitManager, setShowUnitManager] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  // Excel import state
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; updated: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<string>('');
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*, product_units(*, units(*))').order('name');
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  const fetchUnits = useCallback(async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    setUnits(data ?? []);
  }, []);

  useEffect(() => { fetchProducts(); fetchUnits(); }, [fetchProducts, fetchUnits]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showForm || showScanner || showUnitManager) return;
      if (e.key === 'Enter') {
        const code = barcodeInputRef.current.trim(); barcodeInputRef.current = '';
        if (code.length > 4) searchByBarcode(code);
      } else if (e.key.length === 1) {
        barcodeInputRef.current += e.key;
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => { barcodeInputRef.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showForm, showScanner, showUnitManager]);

  const searchByBarcode = async (code: string) => {
    const { data } = await supabase.from('products').select('*, product_units(*, units(*))').eq('barcode', code).single();
    if (data) openEdit(data);
  };

  const openAdd = () => { setEditProduct(null); setForm(emptyForm); setUnitRows([]); setImageFile(null); setImagePreview(null); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, price: String(p.price), emoji: p.emoji, barcode: p.barcode ?? '', stock: String(p.stock) });
    setUnitRows((p.product_units ?? []).map(u => ({ unit_id: u.unit_id ?? '', price: String(u.price), barcode: u.barcode ?? '' })));
    setImageFile(null); setImagePreview(p.image_url ?? null); setShowForm(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    const payload = { name: form.name, price: Number(form.price), emoji: form.emoji, barcode: form.barcode || null, stock: Number(form.stock) || 0 };
    let productId = editProduct?.id;
    if (editProduct) {
      await supabase.from('products').update(payload).eq('id', editProduct.id);
      await supabase.from('product_units').delete().eq('product_id', editProduct.id);
    } else {
      const { data } = await supabase.from('products').insert(payload).select().single();
      productId = data?.id;
    }
    if (productId) {
      if (imageFile) {
        setUploadingImage(true);
        const url = await uploadProductImage(imageFile, productId);
        if (url) await supabase.from('products').update({ image_url: url }).eq('id', productId);
        setUploadingImage(false);
      } else if (!imagePreview && editProduct?.image_url) {
        await deleteProductImage(productId);
        await supabase.from('products').update({ image_url: null }).eq('id', productId);
      }
      const validRows = unitRows.filter(r => r.unit_id && r.price);
      if (validRows.length > 0) {
        await supabase.from('product_units').insert(validRows.map(r => {
          const u = units.find(x => x.id === r.unit_id);
          return { product_id: productId, unit_id: r.unit_id, name: u?.name ?? '', price: Number(r.price), barcode: r.barcode || null };
        }));
      }
    }
    setSaving(false); setShowForm(false); fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ຕ້ອງການລຶບສິນຄ້ານີ້ແທ້ບໍ?')) return;
    await deleteProductImage(id);
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  // Excel Export
  const handleExport = () => exportProductsToExcel(products, 'products');

  // Excel Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportError(''); setImportResult(null);
    try {
      const parsed = await parseProductsFromExcel(file);
      if (parsed.products.length === 0) { setImportError('ບໍ່ພົບຂໍ້ມູນໃນ Excel'); return; }
      setImportPreview(parsed);
    } catch (err) {
      setImportError('ໄຟລ໌ບໍ່ຖືກຕ້ອງ ກະລຸນາໃຊ້ template ທີ່ export ໄວ້');
    }
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    let added = 0, updated = 0;

    for (const p of importPreview.products) {
      const payload = { name: p.name, price: p.price, emoji: p.emoji || '🛍️', barcode: p.barcode || null, stock: p.stock || 0 };
      if (p.id) {
        const { data } = await supabase.from('products').select('id').eq('id', p.id).single();
        if (data) {
          await supabase.from('products').update(payload).eq('id', p.id);
          // Update units: delete old + insert new from units sheet
          const relatedUnits = importPreview.units.filter(u => u.productId === p.id);
          if (relatedUnits.length > 0) {
            await supabase.from('product_units').delete().eq('product_id', p.id);
            // Find or create unit types
            for (const u of relatedUnits) {
              let unitId = u.unitId;
              if (!unitId) {
                const { data: existingUnit } = await supabase.from('units').select('id').eq('name', u.unitName).single();
                if (existingUnit) { unitId = existingUnit.id; }
                else {
                  const { data: newUnit } = await supabase.from('units').insert({ name: u.unitName }).select().single();
                  unitId = newUnit?.id;
                }
              }
              if (unitId) {
                await supabase.from('product_units').insert({ product_id: p.id, unit_id: unitId, name: u.unitName, price: u.price, barcode: u.barcode });
              }
            }
          }
          updated++;
        } else {
          const { data: newP } = await supabase.from('products').insert(payload).select().single();
          added++;
          // Add units for new product
          if (newP) {
            const relatedUnits = importPreview.units.filter(u => u.productId === p.id || u.productName === p.name);
            for (const u of relatedUnits) {
              const { data: existingUnit } = await supabase.from('units').select('id').eq('name', u.unitName).single();
              let unitId = existingUnit?.id;
              if (!unitId) {
                const { data: newUnit } = await supabase.from('units').insert({ name: u.unitName }).select().single();
                unitId = newUnit?.id;
              }
              if (unitId) {
                await supabase.from('product_units').insert({ product_id: newP.id, unit_id: unitId, name: u.unitName, price: u.price, barcode: u.barcode });
              }
            }
          }
        }
      } else {
        const { data: newP } = await supabase.from('products').insert(payload).select().single();
        added++;
        if (newP) {
          const relatedUnits = importPreview.units.filter(u => u.productName === p.name);
          for (const u of relatedUnits) {
            const { data: existingUnit } = await supabase.from('units').select('id').eq('name', u.unitName).single();
            let unitId = existingUnit?.id;
            if (!unitId) {
              const { data: newUnit } = await supabase.from('units').insert({ name: u.unitName }).select().single();
              unitId = newUnit?.id;
            }
            if (unitId) {
              await supabase.from('product_units').insert({ product_id: newP.id, unit_id: unitId, name: u.unitName, price: u.price, barcode: u.barcode });
            }
          }
        }
      }
    }

    setImporting(false);
    setImportPreview(null);
    setImportResult({ added, updated });
    fetchProducts(); fetchUnits();
    setTimeout(() => setImportResult(null), 4000);
  };

  const handleBarcodeScanned = (code: string) => {
    setShowScanner(false);
    if (scanTarget === 'form') setForm((f) => ({ ...f, barcode: code }));
    else if (typeof scanTarget === 'number') setUnitRows(prev => prev.map((r, i) => i === scanTarget ? { ...r, barcode: code } : r));
  };

  const addUnitRow = () => setUnitRows(prev => [...prev, { unit_id: '', price: '', barcode: '' }]);
  const removeUnitRow = (idx: number) => setUnitRows(prev => prev.filter((_, i) => i !== idx));
  const updateUnitRow = (idx: number, field: string, value: string) => setUnitRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-3 md:p-6 pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">ຈັດການສິນຄ້າ</h1>
            <p className="text-sm text-gray-400 mt-0.5">{products.length} ລາຍການ</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowUnitManager(true)}
              className="px-3 py-2 border border-gray-200 bg-white text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50">
              ⚙️ Unit
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1 px-3 py-2 border border-green-200 bg-green-50 text-green-700 text-xs font-medium rounded-xl hover:bg-green-100">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              Export
            </button>
            <label className="flex items-center gap-1 px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium rounded-xl hover:bg-blue-100 cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              Import
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden"/>
            </label>
            <button onClick={openAdd}
              className="flex items-center gap-1 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              ເພີ່ມ
            </button>
          </div>
        </div>

        {/* Import result */}
        {importResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm text-green-700">
            ✅ Import ສຳເລັດ — ເພີ່ມໃໝ່ {importResult.added} ລາຍການ, ອັບເດດ {importResult.updated} ລາຍການ
          </div>
        )}
        {importError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-600">
            ❌ {importError}
          </div>
        )}

        {/* Search + barcode actions */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-1 shadow-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input type="text" placeholder="ຄົ້ນຫາສິນຄ້າ, barcode..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"/>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Barcode print buttons */}
          {selectedIds.size > 0 && (
            <button onClick={() => {
              const selected = products.filter(p => selectedIds.has(p.id) && p.barcode);
              setBarcodeProducts(selected);
              setShowBarcodeSheet(true);
            }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-purple-600 text-white text-xs font-medium rounded-xl hover:bg-purple-700 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1zm12 0h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1zM5 20h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1z"/>
              </svg>
              Barcode ({selectedIds.size})
            </button>
          )}
          <button onClick={() => {
            const all = products.filter(p => p.barcode);
            setBarcodeProducts(all);
            setShowBarcodeSheet(true);
          }}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium rounded-xl hover:bg-purple-100 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1zm12 0h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1zM5 20h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1z"/>
            </svg>
            ທັງໝົດ
          </button>
        </div>

        {/* Products table */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {(() => {
              const filtered = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.barcode && p.barcode.includes(searchQuery))
              );
              return filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  {searchQuery ? `ບໍ່ພົບ "${searchQuery}"` : 'ຍັງບໍ່ມີສິນຄ້າ'}
                </div>
              ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox"
                        checked={filtered.length > 0 && filtered.every(p => selectedIds.has(p.id))}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set(filtered.map(p => p.id)));
                          else setSelectedIds(new Set());
                        }}
                        className="w-4 h-4 rounded accent-gray-900 cursor-pointer"/>
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-400">ສິນຄ້າ</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-400">ລາຄາ</th>
                    <th className="text-center px-2 py-3 text-xs font-medium text-gray-400 hidden sm:table-cell">Units</th>
                    <th className="text-right px-2 py-3 text-xs font-medium text-gray-400 hidden sm:table-cell">ສາງ</th>
                    <th className="px-2 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(p.id) ? 'bg-purple-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={e => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            setSelectedIds(next);
                          }}
                          className="w-4 h-4 rounded accent-gray-900 cursor-pointer"/>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                            {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover"/> : <span className="text-xl">{p.emoji}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                            {p.barcode && <p className="text-xs text-gray-400 font-mono truncate">{p.barcode}</p>}
                            {/* Show units + stock on mobile */}
                            <div className="flex items-center gap-1.5 mt-0.5 sm:hidden">
                              {p.product_units && p.product_units.length > 0 && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{p.product_units.length} unit</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full
                                ${p.stock > 10 ? 'bg-green-50 text-green-600' : p.stock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                ສາງ {p.stock}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-gray-700 whitespace-nowrap">{p.price.toLocaleString()} ₭</td>
                      <td className="px-2 py-2.5 text-center hidden sm:table-cell">
                        {p.product_units && p.product_units.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {p.product_units.map(u => <span key={u.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{u.units?.name ?? u.name}</span>)}
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right hidden sm:table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                          ${p.stock > 10 ? 'bg-green-50 text-green-600' : p.stock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {p.barcode && (
                            <button onClick={() => { setBarcodeProducts([p]); setShowBarcodeSheet(true); }}
                              className="text-xs text-purple-500 hover:text-purple-700">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1zm12 0h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1zM5 20h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1z"/>
                              </svg>
                            </button>
                          )}
                          <button onClick={() => openEdit(p)} className="text-xs text-blue-500 hover:text-blue-700">ແກ້ໄຂ</button>
                          <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">ລຶບ</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              );
            })()}
          </div>
        )}
      </div>

      {/* Barcode Print Modal */}
      {showBarcodeSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">ພິມ Barcode ({barcodeProducts.length} ລາຍການ)</h2>
              <button onClick={() => setShowBarcodeSheet(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">ຈຳນວນ label ຕໍ່ລາຍການ:</label>
                <input type="number" min={1} max={100} value={labelsPerItem}
                  onChange={e => setLabelsPerItem(Number(e.target.value))}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-gray-400 text-center"/>
              </div>
              <p className="text-xs text-gray-400">ລວມ: {barcodeProducts.length * labelsPerItem} labels</p>

              {/* Preview */}
              <div className="border border-gray-100 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                {barcodeProducts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-mono text-gray-400">{p.barcode}</span>
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto font-medium">{p.price.toLocaleString()} ₭</span>
                  </div>
                ))}
                {barcodeProducts.length > 5 && (
                  <p className="text-xs text-gray-400 text-center">...ແລະ {barcodeProducts.length - 5} ລາຍການອີກ</p>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowBarcodeSheet(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
                ຍົກເລີກ
              </button>
              <button onClick={() => {
                // Generate EAN13/Code128 barcode as inline SVG — no CDN needed
                function genBarcodeSVG(code: string): string {
                  // Code128 B encoding
                  const CODE128B: Record<string, number> = {};
                  const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
                  chars.split('').forEach((c, i) => { CODE128B[c] = i + 32; });
                  
                  const patterns: Record<number, string> = {
                    0:'11011001100',1:'11001101100',2:'11001100110',3:'10010011000',4:'10010001100',
                    5:'10001001100',6:'10011001000',7:'10011000100',8:'10001100100',9:'11001001000',
                    10:'11001000100',11:'11000100100',12:'10110011100',13:'10011011100',14:'10011001110',
                    15:'10111001100',16:'10011101100',17:'10011100110',18:'11001110010',19:'11001011100',
                    20:'11001001110',21:'11011100100',22:'11001110100',23:'11101101110',24:'11101001100',
                    25:'11100101100',26:'11100100110',27:'11101100100',28:'11100110100',29:'11100110010',
                    30:'11011011000',31:'11011000110',32:'11000110110',33:'10100011000',34:'10001011000',
                    35:'10001000110',36:'10110001000',37:'10001101000',38:'10001100010',39:'11010001000',
                    40:'11000101000',41:'11000100010',42:'10110111000',43:'10110001110',44:'10001101110',
                    45:'10111011000',46:'10111000110',47:'10001110110',48:'11101110110',49:'11010001110',
                    50:'11000101110',51:'11011101000',52:'11011100010',53:'11011101110',54:'11101011000',
                    55:'11101000110',56:'11100010110',57:'11101101000',58:'11101100010',59:'11100011010',
                    60:'11101111010',61:'11001000010',62:'11110001010',63:'10100110000',64:'10100001100',
                    65:'10010110000',66:'10010000110',67:'10000101100',68:'10000100110',69:'10110010000',
                    70:'10110000100',71:'10011010000',72:'10011000010',73:'10000110100',74:'10000110010',
                    75:'11000010010',76:'11001010000',77:'11110111010',78:'11000010100',79:'10001111010',
                    80:'10100111100',81:'10010111100',82:'10010011110',83:'10111100100',84:'10011110100',
                    85:'10011110010',86:'11110100100',87:'11110010100',88:'11110010010',89:'11011011110',
                    90:'11011110110',91:'11110110110',92:'10101111000',93:'10100011110',94:'10001011110',
                    95:'10111101000',96:'10111100010',97:'11110101000',98:'11110100010',99:'10111011110',
                    100:'10111101110',101:'11101011110',102:'11110101110',103:'11010000100',104:'11010010000',
                    105:'11010011100',106:'1100011101011'
                  };

                  // Start B=104, stop=106
                  let vals = [104];
                  let checksum = 104;
                  const safeCode = code.replace(/[^\x20-\x7E]/g, '?');
                  safeCode.split('').forEach((c, i) => {
                    const v = (c.charCodeAt(0) - 32 + 64) % 96 + 32;
                    const idx = v - 32;
                    vals.push(idx);
                    checksum += idx * (i + 1);
                  });
                  vals.push(checksum % 103);
                  vals.push(106);

                  let bars = '10'; // quiet zone start
                  vals.forEach(v => { bars += (patterns[v] || ''); });
                  bars += '11'; // quiet zone end

                  const W = 1.5, H = 50;
                  const totalW = bars.length * W;
                  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${H + 14}" viewBox="0 0 ${totalW} ${H + 14}">`;
                  let x = 0;
                  for (const b of bars) {
                    if (b === '1') svg += `<rect x="${x}" y="0" width="${W}" height="${H}" fill="black"/>`;
                    x += W;
                  }
                  svg += `<text x="${totalW/2}" y="${H + 12}" text-anchor="middle" font-family="monospace" font-size="10" fill="black">${safeCode}</text>`;
                  svg += '</svg>';
                  return svg;
                }

                const items: {name: string; barcode: string; price: number}[] = [];
                barcodeProducts.forEach(p => {
                  for (let i = 0; i < labelsPerItem; i++) {
                    items.push({ name: p.name, barcode: p.barcode!, price: p.price });
                  }
                });

                const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: white; }
  .grid { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; }
  .label { width: 160px; border: 1px solid #ddd; border-radius: 6px; padding: 6px 4px; text-align: center; page-break-inside: avoid; }
  .name { font-size: 9px; color: #333; margin-bottom: 3px; line-height: 1.3; min-height: 2.6em; display: flex; align-items: center; justify-content: center; }
  .price { font-size: 12px; font-weight: 700; color: #111; margin-top: 3px; }
  .bc { display: flex; justify-content: center; }
  @media print { @page { margin: 5mm; size: A4; } body { -webkit-print-color-adjust: exact; } }
</style></head>
<body>
<div class="grid">
${items.map(item => `
  <div class="label">
    <div class="name">${item.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="bc">${genBarcodeSVG(item.barcode)}</div>
    <div class="price">${item.price.toLocaleString()} ₭</div>
  </div>`).join('')}
</div>
<script>window.onload = function() { setTimeout(() => window.print(), 300); };<\/script>
</body></html>`;

                const win = window.open('', '_blank');
                if (win) { win.document.write(html); win.document.close(); }
                setShowBarcodeSheet(false);
                setSelectedIds(new Set());
              }}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
                </svg>
                ພິມ Barcode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setImportPreview(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-medium text-gray-800">ກວດສອບຂໍ້ມູນກ່ອນ Import</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {importPreview.products.length} ສິນຄ້າ
                  {importPreview.units.length > 0 && ` · ${importPreview.units.length} units`}
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">ຊື່</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">ລາຄາ</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-400">Emoji</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">ສາງ</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-400">ສະຖານະ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {importPreview.products.map((p, idx) => {
                    const existing = products.find(ep => ep.id === p.id);
                    const relatedUnits = importPreview.units.filter(u => u.productId === p.id || u.productName === p.name);
                    return (
                      <>
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-sm text-gray-800">{p.name}</td>
                          <td className="px-4 py-2.5 text-right text-sm text-gray-700">{p.price.toLocaleString()} ₭</td>
                          <td className="px-4 py-2.5 text-center text-lg">{p.emoji}</td>
                          <td className="px-4 py-2.5 text-right text-sm text-gray-700">{p.stock}</td>
                          <td className="px-4 py-2.5 text-center">
                            {existing ? (
                              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">ອັບເດດ</span>
                            ) : (
                              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">ໃໝ່</span>
                            )}
                          </td>
                        </tr>
                        {relatedUnits.map((u, uidx) => (
                          <tr key={`${idx}-unit-${uidx}`} className="bg-blue-50/30">
                            <td className="px-4 py-1.5 pl-8 text-xs text-blue-600">
                              ↳ {u.unitName}
                            </td>
                            <td className="px-4 py-1.5 text-right text-xs text-blue-600">{u.price.toLocaleString()} ₭</td>
                            <td className="px-4 py-1.5 text-center text-xs text-gray-400">unit</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{u.barcode ?? '—'}</td>
                            <td className="px-4 py-1.5 text-center">
                              <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">unit</span>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setImportPreview(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                ຍົກເລີກ
              </button>
              <button onClick={handleImportConfirm} disabled={importing}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {importing ? 'ກຳລັງ Import...' : `ຢືນຢັນ Import ${importPreview.products.length} ສິນຄ້າ${importPreview.units.length > 0 ? ` + ${importPreview.units.length} units` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-800">{editProduct ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າໃໝ່'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Image */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">ຮູບສິນຄ້າ</label>
                <div className="flex items-start gap-3">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50 shrink-0 relative">
                    {imagePreview ? (
                      <><img src={imagePreview} alt="preview" className="w-full h-full object-cover"/>
                        <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                      </>
                    ) : <span className="text-3xl">{form.emoji}</span>}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="img-upload"/>
                    <label htmlFor="img-upload" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/>
                      </svg>
                      ເລືອກຮູບ
                    </label>
                    {imageFile && <p className="text-xs text-green-600">✓ {imageFile.name}</p>}
                  </div>
                </div>
              </div>
              {/* Emoji */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Emoji (ຖ້າບໍ່ມີຮູບ)</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className={`text-2xl p-1.5 rounded-lg transition-colors ${form.emoji === e ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}>{e}</button>
                  ))}
                </div>
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ຊື່ສິນຄ້າ</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
              </div>
              {/* Price + Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ລາຄາ (₭)</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ສາງ</label>
                  <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
              </div>
              {/* Barcode */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Barcode</label>
                <div className="flex gap-2">
                  <input type="text" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-gray-400"/>
                  <button onClick={() => { setScanTarget('form'); setShowScanner(true); }}
                    className="px-3 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 0 2 2h4M21 9V5a2 2 0 0 0-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4"/>
                    </svg>
                  </button>
                </div>
              </div>
              {/* Units */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">Units ເພີ່ມເຕີມ</label>
                  <button onClick={addUnitRow} className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ ເພີ່ມ</button>
                </div>
                <div className="space-y-2">
                  {unitRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-gray-50 rounded-xl p-3">
                      <div className="flex-1 space-y-2">
                        <select value={row.unit_id} onChange={e => updateUnitRow(idx, 'unit_id', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white">
                          <option value="">ເລືອກ unit...</option>
                          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <input type="number" value={row.price} onChange={e => updateUnitRow(idx, 'price', e.target.value)}
                            placeholder="ລາຄາ ₭"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-gray-400 bg-white"/>
                          <div className="flex gap-1 flex-1">
                            <input type="text" value={row.barcode} onChange={e => updateUnitRow(idx, 'barcode', e.target.value)}
                              placeholder="Barcode"
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-gray-400 bg-white"/>
                            <button onClick={() => { setScanTarget(idx); setShowScanner(true); }}
                              className="px-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-white bg-white">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 0 2 2h4M21 9V5a2 2 0 0 0-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeUnitRow(idx)} className="text-red-400 hover:text-red-600 mt-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">ຍົກເລີກ</button>
              <button onClick={handleSave} disabled={saving || uploadingImage || !form.name || !form.price}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-30">
                {uploadingImage ? 'Upload ຮູບ...' : saving ? 'ບັນທຶກ...' : editProduct ? 'ບັນທຶກ' : 'ເພີ່ມ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Manager */}
      {showUnitManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowUnitManager(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-800">ຈັດການ Unit</h2>
              <button onClick={() => setShowUnitManager(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2">
                <input type="text" value={newUnitName} onChange={e => setNewUnitName(e.target.value)}
                  onKeyDown={async (e) => { if (e.key === 'Enter' && newUnitName.trim()) { await supabase.from('units').insert({ name: newUnitName.trim() }); setNewUnitName(''); fetchUnits(); } }}
                  placeholder="ຊື່ unit ໃໝ່"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                <button onClick={async () => { if (newUnitName.trim()) { await supabase.from('units').insert({ name: newUnitName.trim() }); setNewUnitName(''); fetchUnits(); } }}
                  className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">ເພີ່ມ</button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {units.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{u.name}</span>
                    <button onClick={async () => { await supabase.from('units').delete().eq('id', u.id); fetchUnits(); }}
                      className="text-xs text-red-400 hover:text-red-600">ລຶບ</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => setShowUnitManager(false)}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700">ສຳເລັດ</button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScanned={handleBarcodeScanned} onClose={() => setShowScanner(false)}/>}
    </div>
  );
}
