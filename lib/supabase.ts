import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Staff = {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'cashier';
  active: boolean;
  created_at: string;
};

export type Promotion = {
  id: string;
  name: string;
  type: 'percent' | 'fixed' | 'buy_x_get_y';
  value: number;
  min_amount: number;
  buy_qty: number;
  get_qty: number;
  code: string | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type Unit = {
  id: string;
  name: string;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image_url: string | null;
  barcode: string | null;
  stock: number;
  created_at: string;
  product_units?: ProductUnit[];
};

export type ProductUnit = {
  id: string;
  product_id: string;
  unit_id: string | null;
  name: string;
  price: number;
  barcode: string | null;
  created_at: string;
  units?: Unit;
};

export type Order = {
  id: string;
  total: number;
  discount: number;
  payment_method: 'cash' | 'qr' | 'card';
  received: number | null;
  change: number | null;
  staff_id: string | null;
  promotion_id: string | null;
  created_at: string;
  order_items?: OrderItem[];
  staff?: Staff;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
};

export type CartItem = {
  productId: string;
  unitId: string | null;
  name: string;
  unitName: string | null;
  price: number;
  quantity: number;
};

export async function uploadProductImage(file: File, productId: string): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `${productId}.${ext}`;
  await supabase.storage.from('product-images').remove([path]);
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
  if (error) { console.error('Upload error:', error); return null; }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl + `?t=${Date.now()}`;
}

export async function deleteProductImage(productId: string) {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    await supabase.storage.from('product-images').remove([`${productId}.${ext}`]);
  }
}

// Calculate discount amount
export function calcDiscount(promotion: Promotion | null, subtotal: number): number {
  if (!promotion || !promotion.active) return 0;
  if (subtotal < promotion.min_amount) return 0;
  if (promotion.type === 'percent') return Math.round(subtotal * promotion.value / 100);
  if (promotion.type === 'fixed') return Math.min(promotion.value, subtotal);
  return 0;
}
