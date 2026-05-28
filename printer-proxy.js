const WebSocket = require('ws');
const net = require('net');
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });
console.log('✅ Proxy ready - connect: ws://192.168.123.16:8080');
wss.on('connection', (ws) => {
  const tcp = new net.Socket();
  tcp.connect(9100, '192.168.123.100', () => console.log('🖨️ Printer connected'));
  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    tcp.write(buf);
    console.log(`📤 ${buf.length} bytes sent`);
  });
  tcp.on('error', (e) => { console.error('❌', e.message); ws.close(); });
  tcp.on('close', () => ws.close());
  ws.on('close', () => tcp.destroy());
});
