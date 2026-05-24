'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Order, type OrderItem } from '@/lib/supabase';
import { exportOrdersToExcel } from '@/lib/excel';

type Period = 'today' | '7d' | '30d' | 'custom';

const PERIOD_LABEL: Record<Period, string> = {
  today: 'ວັນນີ້',
  '7d': '7 ວັນ',
  '30d': '30 ວັນ',
  custom: 'ກຳນົດເອງ',
};

interface DailyStat { date: string; total: number; count: number; }
interface TopProduct { name: string; quantity: number; revenue: number; }
interface LowStockItem { id: string; name: string; stock: number; emoji: string; }

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [topCount, setTopCount] = useState(5);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Date range
    let from: Date | null = null;
    let to: Date | null = null;

    if (period === 'today') {
      from = new Date(); from.setHours(0,0,0,0);
      to = new Date(); to.setHours(23,59,59,999);
    } else if (period === '7d') {
      from = new Date(); from.setDate(from.getDate()-7); from.setHours(0,0,0,0);
    } else if (period === '30d') {
      from = new Date(); from.setDate(from.getDate()-30); from.setHours(0,0,0,0);
    } else if (period === 'custom' && dateFrom && dateTo) {
      from = new Date(dateFrom); from.setHours(0,0,0,0);
      to = new Date(dateTo); to.setHours(23,59,59,999);
    }

    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: true });
    if (from) query = query.gte('created_at', from.toISOString());
    if (to) query = query.lte('created_at', to.toISOString());

    const [{ data: ordersData }, { data: stockData }] = await Promise.all([
      query,
      supabase.from('products').select('id, name, stock, emoji').lte('stock', 10).order('stock', { ascending: true }).limit(10),
    ]);

    setOrders(ordersData ?? []);
    setLowStock(stockData ?? []);
    setLoading(false);
  }, [period, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const METHOD_LABEL: Record<string, string> = { cash: 'ເງິນສົດ', qr: 'QR Code', card: 'ບັດ' };

  const summary = {
    revenue: orders.reduce((s, o) => s + o.total, 0),
    orders: orders.length,
    avgOrder: orders.length ? Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length) : 0,
    topMethod: (() => {
      const counts: Record<string, number> = {};
      orders.forEach(o => { counts[o.payment_method] = (counts[o.payment_method] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    })(),
  };

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
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, topCount);
  })();

  const maxRevenue = Math.max(...dailyStats.map(d => d.total), 1);
  const maxProductRevenue = Math.max(...topProducts.map(p => p.revenue), 1);

  const paymentStats = (['cash', 'qr', 'card'] as const).map(m => ({
    method: m,
    label: METHOD_LABEL[m],
    count: orders.filter(o => o.payment_method === m).length,
    total: orders.filter(o => o.payment_method === m).reduce((s, o) => s + o.total, 0),
    pct: orders.length ? Math.round((orders.filter(o => o.payment_method === m).length / orders.length) * 100) : 0,
  }));

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6 pb-20 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">ລາຍງານຍອດຂາຍ</p>
          </div>
          <button onClick={() => { setExporting(true); try { exportOrdersToExcel(orders, `orders_${period}`); } finally { setExporting(false); } }}
            disabled={exporting || orders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-xl hover:bg-green-50 hover:border-green-300 hover:text-green-700 disabled:opacity-30 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
            </svg>
            {exporting ? 'ກຳລັງ Export...' : 'Export Excel'}
          </button>
        </div>

        {/* Period selector + date picker */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                  ${period === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 shrink-0">ຈາກ:</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"/>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 shrink-0">ຫາ:</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"/>
              </div>
              <button onClick={fetchData} disabled={!dateFrom || !dateTo}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-30 hover:bg-gray-700">
                ຄົ້ນຫາ
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'ລາຍຮັບລວມ', value: `${summary.revenue.toLocaleString()} ₭`, icon: '💰', color: 'bg-green-50 text-green-700' },
                { label: 'ຈຳນວນບິນ', value: `${summary.orders} ບິນ`, icon: '🧾', color: 'bg-blue-50 text-blue-700' },
                { label: 'ສະເລ່ຍຕໍ່ບິນ', value: `${summary.avgOrder.toLocaleString()} ₭`, icon: '📊', color: 'bg-purple-50 text-purple-700' },
                { label: 'ຊຳລະຫຼາຍສຸດ', value: METHOD_LABEL[summary.topMethod] ?? '—', icon: '💳', color: 'bg-amber-50 text-amber-700' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className={`w-9 h-9 rounded-xl ${card.color.split(' ')[0]} flex items-center justify-center text-lg mb-3`}>{card.icon}</div>
                  <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                  <p className="text-base font-bold text-gray-900">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Low stock alert */}
            {lowStock.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <h2 className="text-sm font-semibold text-red-700">ສາງໃກ້ໝົດ ({lowStock.length} ລາຍການ)</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {lowStock.map(p => (
                    <div key={p.id} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2 border border-red-100">
                      <span className="text-xl">{p.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{p.name}</p>
                        <p className={`text-xs font-bold ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                          {p.stock === 0 ? 'ໝົດສາງ' : `ເຫຼືອ ${p.stock}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-medium text-gray-800 mb-4">ຍອດຂາຍລາຍວັນ</h2>
              {dailyStats.length === 0 ? (
                <div className="text-center py-10 text-gray-300 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
              ) : (
                <div className="space-y-2.5">
                  {dailyStats.map((day) => {
                    const d = new Date(day.date + 'T00:00:00');
                    const label = d.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
                    const pct = Math.round((day.total / maxRevenue) * 100);
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-14 shrink-0 text-right">{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }}/>
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-medium"
                            style={{ color: pct > 35 ? 'white' : '#374151' }}>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-800">ສິນຄ້າຂາຍດີ</h2>
                <select value={topCount} onChange={e => setTopCount(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-2 py-1 text-xs outline-none text-gray-600">
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                </select>
              </div>
              {topProducts.length === 0 ? (
                <div className="text-center py-10 text-gray-300 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.map((product, idx) => {
                    const pct = Math.round((product.revenue / maxProductRevenue) * 100);
                    const colors = ['#f59e0b','#6b7280','#f97316','#3b82f6','#8b5cf6'];
                    return (
                      <div key={product.name} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                          {idx + 1}
                        </span>
                        <span className="text-xs text-gray-700 w-32 shrink-0 truncate">{product.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, background: colors[idx] || '#d1d5db' }}/>
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-medium"
                            style={{ color: pct > 35 ? 'white' : '#374151' }}>
                            {product.revenue.toLocaleString()} ₭
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 w-12 shrink-0 text-right">{product.quantity} ຊ້</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-medium text-gray-800 mb-4">ວິທີຊຳລະເງິນ</h2>
              <div className="grid grid-cols-3 gap-3">
                {paymentStats.map(({ method, label, count, total, pct }) => {
                  const styles = {
                    cash: { bg: 'bg-green-50', text: 'text-green-700', bar: '#16a34a' },
                    qr: { bg: 'bg-blue-50', text: 'text-blue-700', bar: '#2563eb' },
                    card: { bg: 'bg-purple-50', text: 'text-purple-700', bar: '#7c3aed' },
                  }[method] ?? { bg: 'bg-gray-50', text: 'text-gray-700', bar: '#6b7280' };
                  return (
                    <div key={method} className={`${styles.bg} rounded-xl p-4`}>
                      <p className={`text-xs font-medium mb-1 ${styles.text}`}>{label}</p>
                      <p className={`text-2xl font-bold ${styles.text}`}>{pct}%</p>
                      <p className={`text-xs mt-0.5 ${styles.text} opacity-70`}>{count} ບິນ</p>
                      <p className={`text-xs font-medium mt-1 ${styles.text}`}>{total.toLocaleString()} ₭</p>
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
