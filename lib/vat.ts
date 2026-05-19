export interface VATSettings {
  enabled: boolean;
  rate: number;           // e.g. 10 = 10%
  mode: 'inclusive' | 'exclusive';
}

export const DEFAULT_VAT: VATSettings = {
  enabled: false,
  rate: 10,
  mode: 'exclusive',
};

export function loadVATSettings(): VATSettings {
  if (typeof window === 'undefined') return DEFAULT_VAT;
  try {
    const s = localStorage.getItem('pos_vat');
    return s ? { ...DEFAULT_VAT, ...JSON.parse(s) } : DEFAULT_VAT;
  } catch { return DEFAULT_VAT; }
}

export function saveVATSettings(v: VATSettings) {
  localStorage.setItem('pos_vat', JSON.stringify(v));
}

// Calculate VAT and total from subtotal after discount
export function calcVAT(subtotalAfterDiscount: number, vat: VATSettings): {
  vatAmount: number;
  totalBeforeVAT: number;
  grandTotal: number;
} {
  if (!vat.enabled || vat.rate <= 0) {
    return { vatAmount: 0, totalBeforeVAT: subtotalAfterDiscount, grandTotal: subtotalAfterDiscount };
  }

  if (vat.mode === 'inclusive') {
    // VAT already included in price
    // VAT amount = total - (total / (1 + rate/100))
    const vatAmount = Math.round(subtotalAfterDiscount - subtotalAfterDiscount / (1 + vat.rate / 100));
    const totalBeforeVAT = subtotalAfterDiscount - vatAmount;
    return { vatAmount, totalBeforeVAT, grandTotal: subtotalAfterDiscount };
  } else {
    // VAT added on top
    const vatAmount = Math.round(subtotalAfterDiscount * vat.rate / 100);
    return { vatAmount, totalBeforeVAT: subtotalAfterDiscount, grandTotal: subtotalAfterDiscount + vatAmount };
  }
}
