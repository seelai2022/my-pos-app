'use client';

import { type Order } from '@/lib/supabase';
import { loadVATSettings, calcVAT } from '@/lib/vat';

interface ReceiptProps {
  order: Order;
  format: 'thermal' | 'a4';
}

function getSettings() {
  if (typeof window === 'undefined') return null;
  try { const s = localStorage.getItem('pos_settings'); return s ? JSON.parse(s) : null; } catch { return null; }
}

export default function Receipt({ order, format }: ReceiptProps) {
  const settings = getSettings();
  const storeName = settings?.storeName ?? 'POS System';
  const storePhone = settings?.storePhone ?? '020-XXXX-XXXX';
  const storeAddress = settings?.storeAddress ?? 'ວຽງຈັນ, ລາວ';
  const printerWidth = settings?.printerWidth ?? '80mm';
  const vatSettings = loadVATSettings();

  const subtotal = order.order_items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? order.total;
  const discount = order.discount ?? 0;
  const subtotalAfterDiscount = subtotal - discount;
  const { vatAmount, grandTotal } = calcVAT(subtotalAfterDiscount, vatSettings);

  const date = new Date(order.created_at);
  const METHOD_LABEL: Record<string, string> = { cash: 'ເງິນສົດ', qr: 'QR Code', card: 'ບັດ' };

  if (format === 'thermal') {
    return (
      <div style={{ width: printerWidth, fontFamily: 'monospace', fontSize: '12px', color: '#000', padding: '4mm', background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{storeName}</div>
          <div>{storeAddress}</div>
          <div>{storePhone}</div>
          <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}/>
        </div>
        <div style={{ marginBottom: '6px' }}>
          <div>ບິນ: #{order.id.slice(-8).toUpperCase()}</div>
          <div>ວັນທີ: {date.toLocaleDateString()}</div>
          <div>ເວລາ: {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div>ຊຳລະ: {METHOD_LABEL[order.payment_method]}</div>
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}/>
        <div style={{ marginBottom: '6px' }}>
          {order.order_items?.map((item) => (
            <div key={item.id} style={{ marginBottom: '4px' }}>
              <div>{item.product_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity} x {item.price.toLocaleString()} ₭</span>
                <span>{(item.price * item.quantity).toLocaleString()} ₭</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}/>
        <div style={{ marginBottom: '6px' }}>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
              <span>ສ່ວນຫຼຸດ</span><span>-{discount.toLocaleString()} ₭</span>
            </div>
          )}
          {vatSettings.enabled && vatAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}>
              <span>VAT {vatSettings.rate}%</span>
              <span>{vatSettings.mode === 'exclusive' ? '+' : ''}{vatAmount.toLocaleString()} ₭</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
            <span>ລວມທັງໝົດ</span><span>{grandTotal.toLocaleString()} ₭</span>
          </div>
          {order.payment_method === 'cash' && order.received != null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ຮັບມາ</span><span>{order.received.toLocaleString()} ₭</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ເງິນທອນ</span><span>{(order.change ?? 0).toLocaleString()} ₭</span>
              </div>
            </>
          )}
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}/>
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px' }}>
          {vatSettings.enabled && <div>VAT Reg No: XXXX-XXXX</div>}
          <div>ຂອບໃຈທີ່ໃຊ້ບໍລິການ</div>
        </div>
      </div>
    );
  }

  // A4
  return (
    <div style={{ width: '210mm', minHeight: '297mm', fontFamily: 'sans-serif', fontSize: '13px', color: '#111', padding: '16mm', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{storeName}</div>
          <div style={{ color: '#666' }}>{storeAddress}</div>
          <div style={{ color: '#666' }}>{storePhone}</div>
          {vatSettings.enabled && <div style={{ color: '#666', marginTop: '4px' }}>VAT Reg: XXXX-XXXX</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>ໃບເກັບເງິນ</div>
          <div style={{ color: '#666', marginTop: '4px' }}>#{order.id.slice(-8).toUpperCase()}</div>
        </div>
      </div>

      <div style={{ borderTop: '2px solid #111', borderBottom: '1px solid #ddd', padding: '12px 0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#888' }}>ວັນທີ</div>
          <div style={{ fontWeight: '500' }}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#888' }}>ວິທີຊຳລະ</div>
          <div style={{ fontWeight: '500' }}>{METHOD_LABEL[order.payment_method]}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: '#888' }}>ສະຖານະ</div>
          <div style={{ fontWeight: '500', color: '#16a34a' }}>✓ ຊຳລະແລ້ວ</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '12px', color: '#888', fontWeight: '500' }}>ສິນຄ້າ</th>
            <th style={{ textAlign: 'center', padding: '8px 0', fontSize: '12px', color: '#888', fontWeight: '500' }}>ຈຳນວນ</th>
            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '12px', color: '#888', fontWeight: '500' }}>ລາຄາ</th>
            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '12px', color: '#888', fontWeight: '500' }}>ລວມ</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items?.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 0' }}>{item.product_name}</td>
              <td style={{ padding: '10px 0', textAlign: 'center', color: '#666' }}>{item.quantity}</td>
              <td style={{ padding: '10px 0', textAlign: 'right', color: '#666' }}>{item.price.toLocaleString()} ₭</td>
              <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '500' }}>{(item.price * item.quantity).toLocaleString()} ₭</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '260px' }}>
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '12px', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '13px', marginBottom: '6px' }}>
              <span>ລາຄາກ່ອນຫຼຸດ</span><span>{subtotal.toLocaleString()} ₭</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '13px', marginBottom: '6px' }}>
                <span>ສ່ວນຫຼຸດ</span><span>-{discount.toLocaleString()} ₭</span>
              </div>
            )}
            {vatSettings.enabled && vatAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontSize: '13px', marginBottom: '6px' }}>
                <span>VAT {vatSettings.rate}% ({vatSettings.mode === 'inclusive' ? 'ລວມຢູ່ແລ້ວ' : 'ບວກເພີ່ມ'})</span>
                <span>{vatSettings.mode === 'exclusive' ? '+' : ''}{vatAmount.toLocaleString()} ₭</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', borderTop: '2px solid #111', paddingTop: '8px' }}>
              <span>ລວມທັງໝົດ</span><span>{grandTotal.toLocaleString()} ₭</span>
            </div>
            {order.payment_method === 'cash' && order.received != null && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '13px', marginTop: '6px' }}>
                  <span>ຮັບມາ</span><span>{order.received.toLocaleString()} ₭</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '13px' }}>
                  <span>ເງິນທອນ</span><span>{(order.change ?? 0).toLocaleString()} ₭</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '48px', textAlign: 'center', color: '#aaa', fontSize: '12px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
        ຂອບໃຈທີ່ໃຊ້ບໍລິການ — {storeName}
      </div>
    </div>
  );
}
