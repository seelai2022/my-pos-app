'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import BarcodeScanner from '@/components/BarcodeScanner';

interface QuotationItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  emoji: string | null;
}

interface Quotation {
  id: string;
  number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes: string;
  valid_days: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  staff_id: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:    { label: 'ຮ່າງ',     color: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'ສົ່ງແລ້ວ', color: 'bg-blue-50 text-blue-600' },
  accepted: { label: 'ຍອມຮັບ',  color: 'bg-green-50 text-green-600' },
  rejected: { label: 'ປະຕິເສດ', color: 'bg-red-50 text-red-600' },
};

function generateNumber() {
  const d = new Date();
  return `QT${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

const emptyItem = (): QuotationItem => ({ id: Date.now().toString(), name: '', qty: 1, unit: 'ອັນ', price: 0, total: 0 });

export default function QuotationsPage() {
  const { staff } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editQ, setEditQ] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Form state
  const [number, setNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [vatRate, setVatRate] = useState(10);
  const [useVat, setUseVat] = useState(false);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(30);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const afterDiscount = subtotal - discount;
  const vatAmount = useVat ? Math.round(afterDiscount * vatRate / 100) : 0;
  const total = afterDiscount + vatAmount;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: qData }, { data: pData }] = await Promise.all([
      supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, price, barcode, emoji').order('name'),
    ]);
    setQuotations(qData ?? []);
    setProducts(pData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditQ(null);
    setNumber(generateNumber());
    setCustomerName(''); setCustomerPhone(''); setCustomerAddress('');
    setItems([emptyItem()]);
    setDiscount(0); setVatRate(10); setUseVat(false);
    setNotes(''); setValidDays(30);
    setShowForm(true);
  };

  const openEdit = (q: Quotation) => {
    setEditQ(q);
    setNumber(q.number);
    setCustomerName(q.customer_name); setCustomerPhone(q.customer_phone); setCustomerAddress(q.customer_address);
    setItems(q.items.length > 0 ? q.items : [emptyItem()]);
    setDiscount(q.discount); setVatRate(q.vat_rate || 10); setUseVat(q.vat_rate > 0);
    setNotes(q.notes || ''); setValidDays(q.valid_days || 30);
    setShowForm(true);
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.total = Number(updated.qty) * Number(updated.price);
      return updated;
    }));
  };

  const handleProductSelect = (itemId: string, productName: string) => {
    const found = products.find(p => p.name === productName);
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const price = found ? found.price : item.price;
      return { ...item, name: productName, price, total: item.qty * price };
    }));
  };

  // Handle barcode scan — add product to items list
  const handleScanned = (code: string) => {
    setShowScanner(false);
    // Beep sound
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1800;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {}

    const product = products.find(p => p.barcode === code);
    if (!product) {
      alert(`ບໍ່ພົບສິນຄ້າ barcode: ${code}`);
      return;
    }
    // Check if already in items
    const existing = items.find(i => i.name === product.name);
    if (existing) {
      setItems(prev => prev.map(i =>
        i.name === product.name
          ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.price }
          : i
      ));
    } else {
      // Replace empty item or add new
      const emptyIdx = items.findIndex(i => i.name === '');
      const newItem: QuotationItem = {
        id: Date.now().toString(),
        name: product.name,
        qty: 1,
        unit: 'ອັນ',
        price: product.price,
        total: product.price,
      };
      if (emptyIdx >= 0) {
        setItems(prev => prev.map((i, idx) => idx === emptyIdx ? newItem : i));
      } else {
        setItems(prev => [...prev, newItem]);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      number, customer_name: customerName, customer_phone: customerPhone,
      customer_address: customerAddress, items,
      subtotal, discount, vat_rate: useVat ? vatRate : 0,
      vat_amount: vatAmount, total, notes, valid_days: validDays,
      staff_id: staff?.id ?? null,
    };
    if (editQ) {
      await supabase.from('quotations').update(payload).eq('id', editQ.id);
    } else {
      await supabase.from('quotations').insert({ ...payload, status: 'draft' });
    }
    setSaving(false);
    setShowForm(false);
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quotations').update({ status }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ຕ້ອງການລຶບ Quotation ນີ້ແທ້ບໍ?')) return;
    await supabase.from('quotations').delete().eq('id', id);
    fetchData();
  };

  const handlePrint = (q: Quotation) => {
    const settings = (() => { try { return JSON.parse(localStorage.getItem('pos_settings') || '{}'); } catch { return {}; } })();
    const storeName = settings.storeName || 'POS System';
    const storePhone = settings.storePhone || '';
    const storeAddress = settings.storeAddress || '';
    const date = new Date(q.created_at);
    const validUntil = new Date(date.getTime() + q.valid_days * 24 * 60 * 60 * 1000);

    const html = `<!DOCTYPE html>
<html lang="lo"><head><meta charset="UTF-8"/><title>Quotation ${q.number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans Lao',Arial,sans-serif;font-size:13px;color:#111;padding:20mm}
.header{display:flex;justify-content:space-between;margin-bottom:24px}
.store-name{font-size:22px;font-weight:700;margin-bottom:4px}
.store-info{color:#666;font-size:12px;line-height:1.6}
.qt-title{font-size:18px;font-weight:600}
.qt-number{color:#666;font-size:12px;margin-top:4px}
.divider{border-top:2px solid #111;margin:16px 0 8px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.info-label{font-size:11px;color:#888;margin-bottom:2px}
.info-value{font-weight:500}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead tr{border-bottom:2px solid #111}
th{text-align:left;padding:8px 6px;font-size:11px;color:#888;font-weight:500}
th:last-child,td:last-child{text-align:right}
th:nth-child(3),th:nth-child(4),td:nth-child(3),td:nth-child(4){text-align:center}
td{padding:10px 6px;border-bottom:1px solid #f0f0f0}
.summary{display:flex;justify-content:flex-end}
.summary-table{width:260px}
.summary-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
.summary-total{display:flex;justify-content:space-between;font-size:16px;font-weight:700;border-top:2px solid #111;padding-top:8px;margin-top:4px}
.notes{margin-top:24px;padding:12px;background:#f9f9f9;border-radius:8px}
.footer{margin-top:40px;display:flex;justify-content:space-between}
.sign-box{text-align:center;width:160px}
.sign-line{border-top:1px solid #333;margin-top:40px;padding-top:6px;font-size:12px;color:#666}
@media print{body{padding:15mm}@page{size:A4;margin:0}}
</style></head><body>
<div class="header">
  <div><div class="store-name">${storeName}</div><div class="store-info">${storeAddress}<br>${storePhone}</div></div>
  <div style="text-align:right">
    <div class="qt-title">ໃບສະເໜີລາຄາ</div>
    <div class="qt-number">#${q.number}</div>
    <div class="qt-number" style="margin-top:4px">${STATUS_LABEL[q.status]?.label || q.status}</div>
  </div>
</div>
<div class="divider"></div>
<div class="info-grid">
  <div>
    <div class="info-label">ລູກຄ້າ</div>
    <div class="info-value">${q.customer_name || '—'}</div>
    ${q.customer_phone ? `<div style="color:#666;font-size:12px">${q.customer_phone}</div>` : ''}
    ${q.customer_address ? `<div style="color:#666;font-size:12px">${q.customer_address}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div class="info-label">ວັນທີ</div><div class="info-value">${date.toLocaleDateString('lo-LA')}</div>
    <div class="info-label" style="margin-top:8px">ໝົດອາຍຸ</div>
    <div class="info-value">${validUntil.toLocaleDateString('lo-LA')} (${q.valid_days} ວັນ)</div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:40px">#</th><th>ລາຍການ</th>
    <th style="width:60px">ຈຳນວນ</th><th style="width:60px">ຫນ່ວຍ</th>
    <th style="width:100px;text-align:right">ລາຄາ/ຫນ່ວຍ</th><th style="width:110px">ລວມ</th>
  </tr></thead>
  <tbody>
    ${q.items.map((item, idx) => `
    <tr>
      <td style="color:#888">${idx+1}</td><td>${item.name}</td>
      <td style="text-align:center">${item.qty.toLocaleString()}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:right">${item.price.toLocaleString()} ₭</td>
      <td style="text-align:right;font-weight:500">${item.total.toLocaleString()} ₭</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="summary"><div class="summary-table">
  <div class="summary-row"><span style="color:#888">ລາຄາກ່ອນຫຼຸດ</span><span>${q.subtotal.toLocaleString()} ₭</span></div>
  ${q.discount > 0 ? `<div class="summary-row" style="color:#16a34a"><span>ສ່ວນຫຼຸດ</span><span>-${q.discount.toLocaleString()} ₭</span></div>` : ''}
  ${q.vat_rate > 0 ? `<div class="summary-row" style="color:#2563eb"><span>VAT ${q.vat_rate}%</span><span>+${q.vat_amount.toLocaleString()} ₭</span></div>` : ''}
  <div class="summary-total"><span>ລວມທັງໝົດ</span><span>${q.total.toLocaleString()} ₭</span></div>
</div></div>
${q.notes ? `<div class="notes"><div style="font-size:11px;color:#888;margin-bottom:4px">ຫມາຍເຫດ</div><div>${q.notes}</div></div>` : ''}
<div class="footer">
  <div class="sign-box"><div class="sign-line">ຜູ້ສະເໜີລາຄາ</div></div>
  <div class="sign-box"><div class="sign-line">ລູກຄ້າຮັບຮອງ</div></div>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.onload = () => { win.print(); }; }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6 pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ໃບສະເໜີລາຄາ</h1>
            <p className="text-sm text-gray-400 mt-0.5">{quotations.length} ລາຍການ</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            ສ້າງໃໝ່
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-20 text-gray-300 text-sm">ຍັງບໍ່ມີໃບສະເໜີລາຄາ</div>
        ) : (
          <div className="space-y-2">
            {quotations.map(q => (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{q.number}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABEL[q.status]?.color}`}>
                        {STATUS_LABEL[q.status]?.label}
                      </span>
                    </div>
                    {q.customer_name && <p className="text-sm text-gray-600 mt-0.5">{q.customer_name}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      <span>{q.items.length} ລາຍການ</span>
                      <span className="font-semibold text-gray-700">{q.total.toLocaleString()} ₭</span>
                      <span>{new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handlePrint(q)}
                      className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors" title="Print/PDF">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
                      </svg>
                    </button>
                    <button onClick={() => openEdit(q)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1">ແກ້ໄຂ</button>
                    <button onClick={() => handleDelete(q.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">ລຶບ</button>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {['draft','sent','accepted','rejected'].map(s => (
                    <button key={s} onClick={() => updateStatus(q.id, s)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all
                        ${q.status === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {STATUS_LABEL[s]?.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-4 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-base font-semibold text-gray-800">
                {editQ ? 'ແກ້ໄຂໃບສະເໜີ' : 'ສ້າງໃບສະເໜີໃໝ່'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ເລກທີ</label>
                  <input type="text" value={number} onChange={e => setNumber(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ໝົດອາຍຸ (ວັນ)</label>
                  <input type="number" value={validDays} onChange={e => setValidDays(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ຊື່ລູກຄ້າ</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="ຊື່ລູກຄ້າ / ບໍລິສັດ"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ເບີໂທ</label>
                  <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ທີ່ຢູ່</label>
                  <input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">ລາຍການສິນຄ້າ</label>
                  <div className="flex items-center gap-2">
                    {/* Scan button */}
                    <button onClick={() => setShowScanner(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-700 active:scale-95 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 0 2 2h4M21 9V5a2 2 0 0 0-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4"/>
                      </svg>
                      ສະແກນ
                    </button>
                    <button onClick={() => setItems(prev => [...prev, emptyItem()])}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ ເພີ່ມ</button>
                  </div>
                </div>

                {/* Header */}
                <div className="grid grid-cols-12 gap-1.5 mb-1 text-xs text-gray-400 px-1">
                  <div className="col-span-4">ລາຍການ</div>
                  <div className="col-span-2 text-center">ຈຳນວນ</div>
                  <div className="col-span-2 text-center">ຫນ່ວຍ</div>
                  <div className="col-span-3 text-right">ລາຄາ ₭</div>
                  <div className="col-span-1"/>
                </div>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-4">
                        <input type="text" value={item.name}
                          onChange={e => handleProductSelect(item.id, e.target.value)}
                          list={`products-${item.id}`}
                          placeholder="ຊື່ລາຍການ"
                          className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs outline-none focus:border-gray-400"/>
                        <datalist id={`products-${item.id}`}>
                          {products.map(p => (
                            <option key={p.id} value={p.name}/>
                          ))}
                        </datalist>
                      </div>
                      <input type="number" value={item.qty}
                        onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} min={1}
                        className="col-span-2 border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:border-gray-400 text-center"/>
                      <input type="text" value={item.unit}
                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                        className="col-span-2 border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:border-gray-400 text-center"/>
                      <input type="number" value={item.price}
                        onChange={e => updateItem(item.id, 'price', Number(e.target.value))} placeholder="0"
                        className="col-span-3 border border-gray-200 rounded-xl px-2.5 py-2 text-xs outline-none focus:border-gray-400 text-right"/>
                      <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                        className="col-span-1 text-red-400 hover:text-red-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Scanned items count */}
                {items.filter(i => i.name !== '').length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-right">
                    {items.filter(i => i.name !== '').length} ລາຍການ — ລວມ {subtotal.toLocaleString()} ₭
                  </p>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">ລາຄາກ່ອນຫຼຸດ</span>
                  <span className="text-sm font-medium">{subtotal.toLocaleString()} ₭</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 shrink-0">ສ່ວນຫຼຸດ</span>
                  <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gray-400 bg-white text-right"/>
                  <span className="text-sm text-gray-400 shrink-0">₭</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setUseVat(!useVat)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${useVat ? 'bg-blue-500' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${useVat ? 'left-5' : 'left-0.5'}`}/>
                    </button>
                    <span className="text-sm text-gray-500">VAT</span>
                    {useVat && (
                      <div className="flex items-center gap-1">
                        <input type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
                          className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none bg-white text-center"/>
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    )}
                  </div>
                  {useVat && <span className="text-sm text-blue-600">+{vatAmount.toLocaleString()} ₭</span>}
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-base font-semibold text-gray-800">ລວມທັງໝົດ</span>
                  <span className="text-xl font-bold text-gray-900">{total.toLocaleString()} ₭</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ຫມາຍເຫດ</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="ເງື່ອນໄຂການຊຳລະ, ການສົ່ງສິນຄ້າ..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none"/>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                ຍົກເລີກ
              </button>
              <button onClick={handleSave} disabled={saving || !number}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-30">
                {saving ? 'ກຳລັງບັນທຶກ...' : editQ ? 'ບັນທຶກ' : 'ສ້າງ Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner onScanned={handleScanned} onClose={() => setShowScanner(false)}/>
      )}
    </div>
  );
}
