'use client';

export const dynamic = 'force-dynamic';



import { useEffect, useState, useCallback } from 'react';
import { supabase, type Order } from '@/lib/supabase';
import PrintModal from '@/components/PrintModal';

const METHOD_LABEL: Record<string, string> = {
  cash: 'ເງິນສົດ', qr: 'QR Code', card: 'ບັດ',
};
const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-green-50 text-green-600',
  qr: 'bg-blue-50 text-blue-600',
  card: 'bg-purple-50 text-purple-600',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ປະຫວັດອໍເດີ</h1>
            <p className="text-sm text-gray-400 mt-0.5">{orders.length} ບິນ</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm text-right">
            <p className="text-xs text-gray-400">ລາຍຮັບທັງໝົດ</p>
            <p className="text-lg font-semibold text-gray-900">{totalRevenue.toLocaleString()} ₭</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">ກຳລັງໂຫລດ...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
            </svg>
            <p className="text-sm">ຍັງບໍ່ມີອໍເດີ</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const date = new Date(order.created_at);
              const isOpen = expanded === order.id;
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Date */}
                    <div className="shrink-0 text-center w-10">
                      <p className="text-lg font-semibold text-gray-800 leading-none">{date.getDate()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date.toLocaleString('default', { month: 'short' })}
                      </p>
                    </div>

                    {/* Info */}
                    <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded(isOpen ? null : order.id)}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">ບິນ #{order.id.slice(-6).toUpperCase()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${METHOD_COLOR[order.payment_method]}`}>
                          {METHOD_LABEL[order.payment_method]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{order.order_items?.length ?? 0} ລາຍການ
                      </p>
                    </button>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">{order.total.toLocaleString()} ₭</p>
                    </div>

                    {/* Print button */}
                    <button onClick={() => setPrintOrder(order)}
                      className="shrink-0 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                      title="ພິມໃບເກັບເງິນ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
                      </svg>
                    </button>

                    <button onClick={() => setExpanded(isOpen ? null : order.id)}>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                  </div>

                  {isOpen && order.order_items && (
                    <div className="border-t border-gray-50 px-5 py-3 bg-gray-50/50">
                      <ul className="space-y-1.5 mb-3">
                        {order.order_items.map((item) => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                            <span className="text-gray-500">{(item.price * item.quantity).toLocaleString()} ₭</span>
                          </li>
                        ))}
                      </ul>
                      {order.payment_method === 'cash' && order.received != null && (
                        <div className="border-t border-gray-200 pt-2 space-y-1">
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>ຮັບມາ</span><span>{order.received.toLocaleString()} ₭</span>
                          </div>
                          <div className="flex justify-between text-xs text-green-600">
                            <span>ທອນ</span><span>{(order.change ?? 0).toLocaleString()} ₭</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print Modal */}
      {printOrder && (
        <PrintModal order={printOrder} onClose={() => setPrintOrder(null)} />
      )}
    </div>
  );
}
