const WebSocket = require('ws');
const net = require('net');

const WS_PORT = 8080;
const PRINTER_HOST = '192.168.123.100';
const PRINTER_PORT = 9100;

const wss = new WebSocket.Server({ port: WS_PORT, host: '0.0.0.0' });
console.log(`✅ Printer Proxy started on ws://localhost:${WS_PORT}`);
console.log(`📡 Forwarding to ${PRINTER_HOST}:${PRINTER_PORT}`);

wss.on('connection', (ws) => {
  console.log('🔗 Browser connected');
  const tcp = new net.Socket();
  tcp.connect(PRINTER_PORT, PRINTER_HOST, () => {
    console.log(`🖨️ Connected to printer`);
  });
  ws.on('message', (data) => {
    tcp.write(Buffer.isBuffer(data) ? data : Buffer.from(data));
  });
  tcp.on('error', (err) => { console.error('❌ Printer error:', err.message); ws.close(); });
  tcp.on('close', () => ws.close());
  ws.on('close', () => tcp.destroy());
});
