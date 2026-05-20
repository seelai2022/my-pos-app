'use client';

export const dynamic = 'force-dynamic';



import { useEffect, useState, useCallback } from 'react';
import { supabase, type Order, type OrderItem } from '@/lib/supabase';
import { exportOrdersToExcel } from '@/lib/excel';

type Period = 'today' | '7d' | '30d' | 'all';

const PERIOD_LABEL: Record<Period, string> = {
  today: 'ວັນນີ້',
  '7d': '7 ວັນ',
  '30d': '30 ວັນ',
  all: 'ທັງໝົດ',
};

interface DailyStat { date: string; total: number; count: number; }
interface TopProduct { name: string; quantity: number; revenue: number; }
interface Summary { revenue: number; orders: number; avgOrder: number; topMethod: string; }

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: true });
    if (period === 'today') { const s = new Date(); s.setHours(0,0,0,0); query = query.gte('created_at', s.toISOString()); }
    else if (period === '7d') { const s = new Date(); s.setDate(s.getDate()-7); query = query.gte('created_at', s.toISOString()); }
    else if (period === '30d') { const s = new Date(); s.setDate(s.getDate()-30); query = query.gte('created_at', s.toISOString()); }
    const { data } = await query;
    setOrders(data ?? []);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleExport = () => {
    setExporting(true);
    try {
      exportOrdersToExcel(orders, `orders_${PERIOD_LABEL[period]}`);
    } finally {
      setExporting(false);
    }
  };

  const summary: Summary = {
    revenue: orders.reduce((s, o) => s + o.total, 0),
    orders: orders.length,
    avgOrder: orders.length ? Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length) : 0,
    topMethod: (() => {
      const counts: Record<string, number> = {};
      orders.forEach(o => { counts[o.payment_method] = (counts[o.payment_method] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    })(),
  };

  const METHOD_LABEL: Record<string, string> = { cash: 'ເງິນສົດ', qr: 'QR Code', card: 'ບັດ' };

  const dailyStats: DailyStat[] = (() => {
    const map: Record<string, DailyStat> = {};
    orders.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString('en-CA');
      if (!map[d]) map[d] = { date: d, total: 0, count: 0 };
      map[d].total += o.total; map[d].count += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const topProducts: TopProduct[] = (() => {
    const map: Record<string, TopProduct> = {};
    orders.forEach(o => {
      o.order_items?.forEach((item: OrderItem) => {
        if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, quantity: 0, revenue: 0 };
        map[item.product_name].quantity += item.quantity;
        map[item.product_name].revenue += item.price * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  })();

  const maxRevenue = Math.max(...dailyStats.map(d => d.total), 1);
  const maxProductRevenue = Math.max(...topProducts.map(p => p.revenue), 1);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">ລາຍງານຍອດຂາຍ</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Export button */}
            <button onClick={handleExport} disabled={exporting || orders.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-xl hover:bg-green-50 hover:border-green-300 hover:text-green-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
              </svg>
              {exporting ? 'ກຳລັງ Export...' : 'Export Excel'}
            </button>

            {/* Period selector */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${period === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'ລາຍຮັບລວມ', value: `${summary.revenue.toLocaleString()} ₭`, icon: '💰', color: 'bg-green-50 text-green-600' },
                { label: 'ຈຳນວນບິນ', value: `${summary.orders} ບິນ`, icon: '🧾', color: 'bg-blue-50 text-blue-600' },
                { label: 'ສະເລ່ຍຕໍ່ບິນ', value: `${summary.avgOrder.toLocaleString()} ₭`, icon: '📊', color: 'bg-purple-50 text-purple-600' },
                { label: 'ຊຳລະຫຼາຍສຸດ', value: METHOD_LABEL[summary.topMethod] ?? '—', icon: '💳', color: 'bg-amber-50 text-amber-600' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center text-lg mb-3`}>{card.icon}</div>
                  <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                  <p className="text-lg font-semibold text-gray-900">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Daily chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-medium text-gray-800 mb-4">ຍອດຂາຍລາຍວັນ</h2>
              {dailyStats.length === 0 ? (
                <div className="text-center py-10 text-gray-300 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
              ) : (
                <div className="space-y-3">
                  {dailyStats.map((day) => {
                    const d = new Date(day.date);
                    const label = d.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
                    const pct = Math.round((day.total / maxRevenue) * 100);
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-16 shrink-0 text-right">{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}/>
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-medium"
                            style={{ color: pct > 40 ? 'white' : '#374151' }}>
                            {day.total.toLocaleString()} ₭
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 w-12 shrink-0">{day.count} ບິນ</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top products */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-medium text-gray-800 mb-4">ສິນຄ້າຂາຍດີ Top 5</h2>
              {topProducts.length === 0 ? (
                <div className="text-center py-10 text-gray-300 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((product, idx) => {
                    const pct = Math.round((product.revenue / maxProductRevenue) * 100);
                    return (
                      <div key={product.name} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm text-gray-700 w-36 shrink-0 truncate">{product.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: idx === 0 ? '#f59e0b' : idx === 1 ? '#6b7280' : idx === 2 ? '#f97316' : '#d1d5db' }}/>
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-medium"
                            style={{ color: pct > 40 ? 'white' : '#374151' }}>
                            {product.revenue.toLocaleString()} ₭
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 w-14 shrink-0 text-right">{product.quantity} ລາຍ</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-medium text-gray-800 mb-4">ວິທີຊຳລະເງິນ</h2>
              <div className="grid grid-cols-3 gap-4">
                {(['cash', 'qr', 'card'] as const).map((m) => {
                  const count = orders.filter(o => o.payment_method === m).length;
                  const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
                  const colors = { cash: 'bg-green-100 text-green-700', qr: 'bg-blue-100 text-blue-700', card: 'bg-purple-100 text-purple-700' };
                  return (
                    <div key={m} className={`rounded-xl p-4 ${colors[m].split(' ')[0]}`}>
                      <p className={`text-xs font-medium mb-1 ${colors[m].split(' ')[1]}`}>{METHOD_LABEL[m]}</p>
                      <p className={`text-2xl font-bold ${colors[m].split(' ')[1]}`}>{pct}%</p>
                      <p className={`text-xs mt-0.5 opacity-70 ${colors[m].split(' ')[1]}`}>{count} ບິນ</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
