'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Promotion } from '@/lib/supabase';

const emptyForm = {
  name: '', type: 'percent' as Promotion['type'],
  value: '', min_amount: '0', buy_qty: '1', get_qty: '1',
  code: '', start_date: '', end_date: '',
};

const TYPE_LABEL: Record<string, string> = {
  percent: '% ສ່ວນຫຼຸດ',
  fixed: 'ຫຼຸດ LAK',
  buy_x_get_y: 'ຊື້ X ໄດ້ Y',
};

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPromo, setEditPromo] = useState<Promotion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
    setPromos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPromos(); }, [fetchPromos]);

  const openAdd = () => {
    setEditPromo(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: Promotion) => {
    setEditPromo(p);
    setForm({
      name: p.name, type: p.type,
      value: String(p.value), min_amount: String(p.min_amount),
      buy_qty: String(p.buy_qty), get_qty: String(p.get_qty),
      code: p.code ?? '', start_date: p.start_date ?? '', end_date: p.end_date ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.value) return;
    setSaving(true);
    const payload = {
      name: form.name, type: form.type,
      value: Number(form.value), min_amount: Number(form.min_amount) || 0,
      buy_qty: Number(form.buy_qty) || 1, get_qty: Number(form.get_qty) || 1,
      code: form.code || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
    };
    if (editPromo) {
      await supabase.from('promotions').update(payload).eq('id', editPromo.id);
    } else {
      await supabase.from('promotions').insert({ ...payload, active: true });
    }
    setSaving(false);
    setShowForm(false);
    fetchPromos();
  };

  const toggleActive = async (p: Promotion) => {
    await supabase.from('promotions').update({ active: !p.active }).eq('id', p.id);
    fetchPromos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ຕ້ອງການລຶບໂປໂມຊັ່ນນີ້ແທ້ບໍ?')) return;
    await supabase.from('promotions').delete().eq('id', id);
    fetchPromos();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ສ່ວນຫຼຸດ / ໂປໂມຊັ່ນ</h1>
            <p className="text-sm text-gray-400 mt-0.5">{promos.length} ລາຍການ</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            ເພີ່ມໂປໂມ
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : promos.length === 0 ? (
          <div className="text-center py-20 text-gray-300 text-sm">ຍັງບໍ່ມີໂປໂມຊັ່ນ</div>
        ) : (
          <div className="space-y-2">
            {promos.map((p) => (
              <div key={p.id} className={`bg-white rounded-2xl border shadow-sm px-5 py-4
                ${!p.active ? 'opacity-50 border-gray-100' : 'border-gray-100'}`}>
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0
                    ${p.type === 'percent' ? 'bg-green-50' : p.type === 'fixed' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                    {p.type === 'percent' ? '%' : p.type === 'fixed' ? '₭' : '🎁'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TYPE_LABEL[p.type]}
                      </span>
                      {p.code && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-mono">
                          {p.code}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {p.type === 'percent' && <span>ຫຼຸດ {p.value}%</span>}
                      {p.type === 'fixed' && <span>ຫຼຸດ {p.value.toLocaleString()} ₭</span>}
                      {p.type === 'buy_x_get_y' && <span>ຊື້ {p.buy_qty} ໄດ້ {p.get_qty}</span>}
                      {p.min_amount > 0 && <span>ຂັ້ນຕ່ຳ {p.min_amount.toLocaleString()} ₭</span>}
                      {p.start_date && <span>ຕັ້ງແຕ່ {p.start_date}</span>}
                      {p.end_date && <span>ຮອດ {p.end_date}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(p)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${p.active ? 'bg-green-400' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${p.active ? 'left-5' : 'left-0.5'}`}/>
                    </button>
                    <button onClick={() => openEdit(p)} className="text-xs text-blue-500 hover:text-blue-700">ແກ້ໄຂ</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">ລຶບ</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-800">
                {editPromo ? 'ແກ້ໄຂໂປໂມ' : 'ເພີ່ມໂປໂມໃໝ່'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ຊື່ໂປໂມ</label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ເຊັ່ນ: ສ່ວນຫຼຸດທ້າຍເດືອນ"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">ປະເພດ</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['percent', 'fixed', 'buy_x_get_y'] as const).map((t) => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-all
                        ${form.type === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              {form.type !== 'buy_x_get_y' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      {form.type === 'percent' ? 'ສ່ວນຫຼຸດ (%)' : 'ຈຳນວນ (₭)'}
                    </label>
                    <input type="number" value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                      placeholder={form.type === 'percent' ? '10' : '5000'}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">ຍອດຂັ້ນຕ່ຳ (₭)</label>
                    <input type="number" value={form.min_amount} onChange={(e) => setForm(f => ({ ...f, min_amount: e.target.value }))}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">ຊື້ (ຈຳນວນ)</label>
                    <input type="number" value={form.buy_qty} onChange={(e) => setForm(f => ({ ...f, buy_qty: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">ໄດ້ຟຣີ (ຈຳນວນ)</label>
                    <input type="number" value={form.get_qty} onChange={(e) => setForm(f => ({ ...f, get_qty: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Promo Code (ໄວ້ໃຊ້)</label>
                <input type="text" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="ເຊັ່ນ: SAVE10"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-gray-400"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ວັນເລີ່ມ</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ວັນໝົດ</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                ຍົກເລີກ
              </button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.value}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-30">
                {saving ? 'ກຳລັງບັນທຶກ...' : editPromo ? 'ບັນທຶກ' : 'ເພີ່ມ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
