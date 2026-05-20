import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { type Order, type Product } from '@/lib/supabase';

// ---- Export Orders ----
export function exportOrdersToExcel(orders: Order[], filename = 'orders') {
  const rows: Record<string, unknown>[] = orders.flatMap((order): Record<string, unknown>[] => {
    if (!order.order_items || order.order_items.length === 0) {
      return [{
        'ລະຫັດບິນ': order.id.slice(-8).toUpperCase(),
        'ວັນທີ': new Date(order.created_at).toLocaleDateString(),
        'ເວລາ': new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'ສິນຄ້າ': '', 'ຈຳນວນ': '', 'ລາຄາ/ອັນ': '', 'ລວມສິນຄ້າ': '',
        'ສ່ວນຫຼຸດ': order.discount ?? 0,
        'ລວມທັງໝົດ': order.total,
        'ວິທີຊຳລະ': order.payment_method === 'cash' ? 'ເງິນສົດ' : order.payment_method === 'qr' ? 'QR Code' : 'ບັດ',
        'ຮັບມາ': order.received ?? '', 'ເງິນທອນ': order.change ?? '',
      }];
    }
    return order.order_items.map((item, idx) => ({
      'ລະຫັດບິນ': idx === 0 ? order.id.slice(-8).toUpperCase() : '',
      'ວັນທີ': idx === 0 ? new Date(order.created_at).toLocaleDateString() : '',
      'ເວລາ': idx === 0 ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      'ສິນຄ້າ': item.product_name,
      'ຈຳນວນ': item.quantity,
      'ລາຄາ/ອັນ': item.price,
      'ລວມສິນຄ້າ': item.price * item.quantity,
      'ສ່ວນຫຼຸດ': idx === 0 ? (order.discount ?? 0) : '',
      'ລວມທັງໝົດ': idx === 0 ? order.total : '',
      'ວິທີຊຳລະ': idx === 0 ? (order.payment_method === 'cash' ? 'ເງິນສົດ' : order.payment_method === 'qr' ? 'QR Code' : 'ບັດ') : '',
      'ຮັບມາ': idx === 0 ? (order.received ?? '') : '',
      'ເງິນທອນ': idx === 0 ? (order.change ?? '') : '',
    }));
  });

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  rows.push({} as never);
  rows.push({ 'ລະຫັດບິນ': 'ລວມທັງໝົດ', 'ສິນຄ້າ': `${orders.length} ບິນ`, 'ລວມທັງໝົດ': totalRevenue } as never);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 },{ wch: 12 },{ wch: 8 },{ wch: 22 },{ wch: 8 },{ wch: 12 },{ wch: 12 },{ wch: 10 },{ wch: 14 },{ wch: 12 },{ wch: 12 },{ wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ລາຍງານອໍເດີ');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${filename}_${new Date().toLocaleDateString('en-CA')}.xlsx`);
}

// ---- Export Products (with units on separate rows) ----
export function exportProductsToExcel(products: Product[], filename = 'products') {
  // Sheet 1: Products
  const productRows = products.map((p) => ({
    'ID': p.id,
    'ຊື່ສິນຄ້າ': p.name,
    'ລາຄາດີຟໍລ (₭)': p.price,
    'Emoji': p.emoji,
    'Barcode': p.barcode ?? '',
    'ສາງ': p.stock,
    'ຈຳນວນ Unit': p.product_units?.length ?? 0,
    'ວັນທີເພີ່ມ': new Date(p.created_at).toLocaleDateString(),
  }));

  const wsProducts = XLSX.utils.json_to_sheet(productRows);
  wsProducts['!cols'] = [
    { wch: 38 }, { wch: 22 }, { wch: 16 }, { wch: 8 },
    { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
  ];

  // Sheet 2: Product Units
  const unitRows: Record<string, unknown>[] = [];
  products.forEach((p) => {
    if (p.product_units && p.product_units.length > 0) {
      p.product_units.forEach((u) => {
        unitRows.push({
          'Product ID': p.id,
          'ຊື່ສິນຄ້າ': p.name,
          'Unit ID': u.id,
          'ຊື່ Unit': u.units?.name ?? u.name,
          'ລາຄາ Unit (₭)': u.price,
          'Barcode Unit': u.barcode ?? '',
        });
      });
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsProducts, 'ສິນຄ້າ');

  if (unitRows.length > 0) {
    const wsUnits = XLSX.utils.json_to_sheet(unitRows);
    wsUnits['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsUnits, 'Units');
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${filename}_${new Date().toLocaleDateString('en-CA')}.xlsx`);
}

// ---- Import Products from Excel ----
export interface ImportedProduct {
  id?: string;
  name: string;
  price: number;
  emoji: string;
  barcode: string | null;
  stock: number;
}

export interface ImportedUnit {
  productId?: string;
  productName?: string;
  unitId?: string;
  unitName: string;
  price: number;
  barcode: string | null;
}

export interface ImportResult {
  products: ImportedProduct[];
  units: ImportedUnit[];
}

export function parseProductsFromExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        // Parse products sheet
        const productSheet = wb.Sheets['ສິນຄ້າ'] ?? wb.Sheets[wb.SheetNames[0]];
        const productRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(productSheet);

        const products: ImportedProduct[] = productRows
          .filter(row => row['ຊື່ສິນຄ້າ'] && row['ລາຄາດີຟໍລ (₭)'])
          .map(row => ({
            id: row['ID'] ? String(row['ID']) : undefined,
            name: String(row['ຊື່ສິນຄ້າ'] ?? ''),
            price: Number(row['ລາຄາດີຟໍລ (₭)'] ?? 0),
            emoji: String(row['Emoji'] ?? '🛍️'),
            barcode: row['Barcode'] ? String(row['Barcode']) : null,
            stock: Number(row['ສາງ'] ?? 0),
          }));

        // Parse units sheet (optional)
        const units: ImportedUnit[] = [];
        const unitSheetName = wb.SheetNames.find(n => n === 'Units');
        if (unitSheetName) {
          const unitSheet = wb.Sheets[unitSheetName];
          const unitRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(unitSheet);
          unitRows
            .filter(row => row['ຊື່ Unit'] && row['ລາຄາ Unit (₭)'])
            .forEach(row => {
              units.push({
                productId: row['Product ID'] ? String(row['Product ID']) : undefined,
                productName: row['ຊື່ສິນຄ້າ'] ? String(row['ຊື່ສິນຄ້າ']) : undefined,
                unitId: row['Unit ID'] ? String(row['Unit ID']) : undefined,
                unitName: String(row['ຊື່ Unit'] ?? ''),
                price: Number(row['ລາຄາ Unit (₭)'] ?? 0),
                barcode: row['Barcode Unit'] ? String(row['Barcode Unit']) : null,
              });
            });
        }

        resolve({ products, units });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
