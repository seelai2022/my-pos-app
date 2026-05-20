// Web Serial API type declarations
declare global {
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream;
    writable: WritableStream;
  }
}

// ESC/POS Commands
export const ESC = 0x1b;
export const GS = 0x1d;

export const COMMANDS = {
  INIT: [ESC, 0x40],                    // Initialize printer
  FULL_CUT: [GS, 0x56, 0x00],          // Full cut
  PARTIAL_CUT: [GS, 0x56, 0x01],       // Partial cut
  FEED_LINE: [ESC, 0x64, 0x04],        // Feed 4 lines before cut
  ALIGN_CENTER: [ESC, 0x61, 0x01],     // Center align
  ALIGN_LEFT: [ESC, 0x61, 0x00],       // Left align
  BOLD_ON: [ESC, 0x45, 0x01],          // Bold on
  BOLD_OFF: [ESC, 0x45, 0x00],         // Bold off
  FONT_LARGE: [ESC, 0x21, 0x30],       // Double width + height
  FONT_NORMAL: [ESC, 0x21, 0x00],      // Normal font
};

export type CutMode = 'full' | 'partial' | 'none';

// ---- Web Serial API (USB/Bluetooth) ----
let serialPort: SerialPort | null = null;
let serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

export async function connectSerial(): Promise<boolean> {
  try {
    if (!('serial' in navigator)) {
      console.warn('Web Serial API not supported');
      return false;
    }
    serialPort = await (navigator as unknown as { serial: { requestPort: () => Promise<SerialPort> } }).serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    serialWriter = (serialPort.writable as unknown as WritableStream<Uint8Array>).getWriter();
    return true;
  } catch (e) {
    console.error('Serial connect error:', e);
    return false;
  }
}

export async function disconnectSerial() {
  try {
    serialWriter?.releaseLock();
    await serialPort?.close();
    serialPort = null;
    serialWriter = null;
  } catch (e) {
    console.error('Serial disconnect error:', e);
  }
}

export async function sendToSerial(data: number[]): Promise<boolean> {
  try {
    if (!serialWriter) return false;
    await serialWriter.write(new Uint8Array(data));
    return true;
  } catch (e) {
    console.error('Serial write error:', e);
    return false;
  }
}

// ---- Network Printer (TCP via WebSocket proxy) ----
// ໃຊ້ WebSocket proxy ເຊັ່ນ: https://github.com/woosignal/flutter-pos-printer
export async function sendToNetwork(
  ip: string,
  port: number,
  data: number[]
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Try WebSocket proxy on same machine (localhost:8080)
      const ws = new WebSocket(`ws://localhost:8080`);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        const payload = JSON.stringify({ ip, port, data });
        ws.send(payload);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        console.warn('Network printer WebSocket error — falling back to direct fetch');
        // Fallback: direct HTTP proxy
        fetch(`http://localhost:8080/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip, port, data }),
        })
          .then(() => resolve(true))
          .catch(() => resolve(false));
      };

      setTimeout(() => resolve(false), 3000);
    } catch (e) {
      console.error('Network printer error:', e);
      resolve(false);
    }
  });
}

// ---- Build ESC/POS receipt bytes ----
interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  orderId: string;
  date: Date;
  paymentMethod: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  received?: number;
  change?: number;
}

function strToBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

function line(str: string): number[] {
  return [...strToBytes(str), 0x0a]; // + newline
}

function dashes(len = 32): number[] {
  return line('-'.repeat(len));
}

export function buildReceiptBytes(data: ReceiptData, cutMode: CutMode): number[] {
  const METHOD_LABEL: Record<string, string> = {
    cash: 'Cash', qr: 'QR Code', card: 'Card',
  };

  const bytes: number[] = [
    ...COMMANDS.INIT,
    ...COMMANDS.ALIGN_CENTER,
    ...COMMANDS.FONT_LARGE,
    ...COMMANDS.BOLD_ON,
    ...line(data.storeName),
    ...COMMANDS.FONT_NORMAL,
    ...COMMANDS.BOLD_OFF,
    ...line(data.storeAddress),
    ...line(data.storePhone),
    ...dashes(),
    ...COMMANDS.ALIGN_LEFT,
    ...line(`Bill: #${data.orderId.slice(-8).toUpperCase()}`),
    ...line(`Date: ${data.date.toLocaleDateString()}`),
    ...line(`Time: ${data.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
    ...line(`Pay:  ${METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod}`),
    ...dashes(),
  ];

  // Items
  for (const item of data.items) {
    const subtotal = (item.price * item.quantity).toLocaleString();
    const itemLine = `${item.name.slice(0, 18).padEnd(18)} x${item.quantity}`;
    bytes.push(...line(itemLine));
    bytes.push(...line(`  ${item.price.toLocaleString()} x${item.quantity} = ${subtotal} K`));
  }

  bytes.push(...dashes());

  // Total
  bytes.push(
    ...COMMANDS.BOLD_ON,
    ...line(`TOTAL: ${data.total.toLocaleString()} K`),
    ...COMMANDS.BOLD_OFF,
  );

  if (data.paymentMethod === 'cash' && data.received != null) {
    bytes.push(
      ...line(`Recv:  ${data.received.toLocaleString()} K`),
      ...line(`Change:${(data.change ?? 0).toLocaleString()} K`),
    );
  }

  bytes.push(
    ...dashes(),
    ...COMMANDS.ALIGN_CENTER,
    ...line('Thank you!'),
    ...line('Please keep your receipt'),
    ...dashes(),
    // Feed before cut
    ...COMMANDS.FEED_LINE,
  );

  // Auto cut
  if (cutMode === 'full') bytes.push(...COMMANDS.FULL_CUT);
  else if (cutMode === 'partial') bytes.push(...COMMANDS.PARTIAL_CUT);

  return bytes;
}

// ---- Main print function ----
export interface PrintOptions {
  printerType: 'usb' | 'network' | 'both';
  cutMode: CutMode;
  networkIP?: string;
  networkPort?: number;
}

export async function printReceipt(
  data: ReceiptData,
  options: PrintOptions
): Promise<{ success: boolean; message: string }> {
  const bytes = buildReceiptBytes(data, options.cutMode);

  if (options.printerType === 'usb' || options.printerType === 'both') {
    const ok = await sendToSerial(bytes);
    if (!ok && options.printerType === 'usb') {
      return { success: false, message: 'USB printer ບໍ່ໄດ້ເຊື່ອມຕໍ່ — ກົດ "ເຊື່ອມ USB" ກ່ອນ' };
    }
  }

  if (options.printerType === 'network' || options.printerType === 'both') {
    const ok = await sendToNetwork(
      options.networkIP ?? '192.168.1.100',
      options.networkPort ?? 9100,
      bytes
    );
    if (!ok && options.printerType === 'network') {
      return { success: false, message: 'Network printer ເຊື່ອມຕໍ່ບໍ່ໄດ້ — ກວດ IP ແລະ WebSocket proxy' };
    }
  }

  return { success: true, message: 'ພິມສຳເລັດ' };
}
