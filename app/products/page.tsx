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

        {/* Search box */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-4 shadow-sm">
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
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-400">ສິນຄ້າ</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-gray-400">ລາຄາ</th>
                    <th className="text-center px-2 py-3 text-xs font-medium text-gray-400 hidden sm:table-cell">Units</th>
                    <th className="text-right px-2 py-3 text-xs font-medium text-gray-400 hidden sm:table-cell">ສາງ</th>
                    <th className="px-2 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
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
