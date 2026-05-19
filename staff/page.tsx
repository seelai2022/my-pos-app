'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Staff } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const emptyForm = { name: '', pin: '', role: 'cashier' as Staff['role'] };

export default function StaffPage() {
  const { staff: currentStaff } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

  const isAdmin = currentStaff?.role === 'admin';

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('staff').select('*').order('created_at');
    setStaffList(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openAdd = () => {
    setEditStaff(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (s: Staff) => {
    setEditStaff(s);
    setForm({ name: s.name, pin: s.pin, role: s.role });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.pin) return;
    if (form.pin.length < 4) return;
    setSaving(true);

    if (editStaff) {
      await supabase.from('staff').update(form).eq('id', editStaff.id);
    } else {
      await supabase.from('staff').insert({ ...form, active: true });
    }

    setSaving(false);
    setShowForm(false);
    fetchStaff();
  };

  const toggleActive = async (s: Staff) => {
    await supabase.from('staff').update({ active: !s.active }).eq('id', s.id);
    fetchStaff();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ຕ້ອງການລຶບພະນັກງານນີ້ແທ້ບໍ?')) return;
    await supabase.from('staff').delete().eq('id', id);
    fetchStaff();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ພະນັກງານ</h1>
            <p className="text-sm text-gray-400 mt-0.5">{staffList.length} ຄົນ</p>
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              ເພີ່ມພະນັກງານ
            </button>
          )}
        </div>

        {!isAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
            ⚠️ ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດການພະນັກງານໄດ້
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : (
          <div className="space-y-2">
            {staffList.map((s) => (
              <div key={s.id} className={`bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-center gap-4
                ${!s.active ? 'opacity-50' : 'border-gray-100'}`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0
                  ${s.role === 'admin' ? 'bg-gray-900' : 'bg-blue-500'}`}>
                  {s.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${s.role === 'admin' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600'}`}>
                      {s.role === 'admin' ? 'Admin' : 'Cashier'}
                    </span>
                    {s.id === currentStaff?.id && (
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">ທ່ານ</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">PIN: {'•'.repeat(s.pin.length)}</p>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(s)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${s.active ? 'bg-green-400' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s.active ? 'left-5' : 'left-0.5'}`}/>
                    </button>
                    <button onClick={() => openEdit(s)} className="text-xs text-blue-500 hover:text-blue-700">ແກ້ໄຂ</button>
                    {s.id !== currentStaff?.id && (
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:text-red-600">ລຶບ</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-800">
                {editStaff ? 'ແກ້ໄຂພະນັກງານ' : 'ເພີ່ມພະນັກງານ'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ຊື່ພະນັກງານ</label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ເຊັ່ນ: ສົມສັກ"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">PIN (4-6 ຕົວເລກ)</label>
                <div className="flex gap-2">
                  <input type={pinVisible ? 'text' : 'password'} value={form.pin}
                    onChange={(e) => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="ເຊັ່ນ: 1234"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-gray-400"/>
                  <button onClick={() => setPinVisible(!pinVisible)}
                    className="px-3 border border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d={pinVisible ? "M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 0 1 1.563-3.029m5.858.908a3 3 0 1 1 4.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532 3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0 1 12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 0 1-4.132 5.411m0 0L21 21"
                          : "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"}/>
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">ສິດທິ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cashier', label: 'Cashier', desc: 'ໜ້າຂາຍ' },
                    { id: 'admin', label: 'Admin', desc: 'ຄຸ້ມຄອງທັງໝົດ' },
                  ].map((r) => (
                    <button key={r.id} onClick={() => setForm(f => ({ ...f, role: r.id as Staff['role'] }))}
                      className={`py-2.5 px-3 rounded-xl border text-left transition-all
                        ${form.role === r.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className={`text-xs mt-0.5 ${form.role === r.id ? 'text-gray-300' : 'text-gray-400'}`}>{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                ຍົກເລີກ
              </button>
              <button onClick={handleSave} disabled={saving || !form.name || form.pin.length < 4}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-30">
                {saving ? 'ກຳລັງບັນທຶກ...' : editStaff ? 'ບັນທຶກ' : 'ເພີ່ມ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
