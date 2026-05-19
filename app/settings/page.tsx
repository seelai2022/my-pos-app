'use client';

import { useState, useEffect, useRef } from 'react';
import { connectSerial, disconnectSerial, buildReceiptBytes, sendToSerial, sendToNetwork, type CutMode } from '@/lib/escpos';
import { loadVATSettings, saveVATSettings, type VATSettings } from '@/lib/vat';

interface Settings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  printerType: 'thermal_usb' | 'thermal_network' | 'both';
  printerWidth: '58mm' | '80mm';
  printerNetworkIP: string;
  printerNetworkPort: string;
  autoPrint: boolean;
  cutMode: CutMode;
  scannerType: 'usb' | 'camera' | 'both';
  scannerDelay: number;
}

const DEFAULT_SETTINGS: Settings = {
  storeName: 'POS System',
  storePhone: '020-XXXX-XXXX',
  storeAddress: 'ວຽງຈັນ, ລາວ',
  printerType: 'both',
  printerWidth: '80mm',
  printerNetworkIP: '192.168.1.100',
  printerNetworkPort: '9100',
  autoPrint: false,
  cutMode: 'full',
  scannerType: 'both',
  scannerDelay: 100,
};

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const s = localStorage.getItem('pos_settings');
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [vat, setVat] = useState<VATSettings>({ enabled: false, rate: 10, mode: 'exclusive' });
  const [saved, setSaved] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [testScanResult, setTestScanResult] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const barcodeRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setVat(loadVATSettings());
  }, []);

  useEffect(() => {
    if (!scannerActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const code = barcodeRef.current.trim();
        barcodeRef.current = '';
        if (code.length > 2) setTestScanResult(`✅ ສຳເລັດ: ${code}`);
      } else if (e.key.length === 1) {
        barcodeRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { barcodeRef.current = ''; }, settings.scannerDelay + 50);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scannerActive, settings.scannerDelay]);

  const update = (key: keyof Settings, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updateVAT = (key: keyof VATSettings, value: unknown) => {
    setVat((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('pos_settings', JSON.stringify(settings));
    saveVATSettings(vat);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleConnectUSB = async () => {
    if (usbConnected) {
      await disconnectSerial();
      setUsbConnected(false);
      setTestResult({ ok: true, msg: 'ຕັດການເຊື່ອມຕໍ່ USB ແລ້ວ' });
    } else {
      const ok = await connectSerial();
      setUsbConnected(ok);
      setTestResult(ok
        ? { ok: true, msg: '✅ ເຊື່ອມຕໍ່ USB Printer ສຳເລັດ' }
        : { ok: false, msg: '❌ ເຊື່ອມຕໍ່ USB ບໍ່ສຳເລັດ — ຕ້ອງໃຊ້ Chrome/Edge' });
    }
  };

  const handleTestPrint = async () => {
    setTestResult(null);
    const testData = {
      storeName: settings.storeName, storeAddress: settings.storeAddress, storePhone: settings.storePhone,
      orderId: 'TEST0001', date: new Date(), paymentMethod: 'cash',
      items: [{ name: 'Test Item', quantity: 2, price: 15000 }],
      total: 30000, received: 50000, change: 20000,
    };
    const bytes = buildReceiptBytes(testData, settings.cutMode);
    if (settings.printerType === 'thermal_usb' || settings.printerType === 'both') {
      if (!usbConnected) { setTestResult({ ok: false, msg: '❌ USB: ກ່ອນເຊື່ອມ USB Printer ກ່ອນ' }); return; }
      const ok = await sendToSerial(bytes);
      setTestResult(ok ? { ok: true, msg: '✅ USB: ພິມ + Auto Cut ສຳເລັດ' } : { ok: false, msg: '❌ USB: ກວດ Printer' });
    }
    if (settings.printerType === 'thermal_network' || settings.printerType === 'both') {
      const ok = await sendToNetwork(settings.printerNetworkIP, Number(settings.printerNetworkPort), bytes);
      setTestResult(ok ? { ok: true, msg: '✅ Network: ພິມ + Auto Cut ສຳເລັດ' } : { ok: false, msg: '❌ Network: ຕ້ອງ run WebSocket proxy' });
    }
  };

  const handleTestCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null; setCameraActive(false); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream; setCameraActive(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const reader = new BrowserMultiFormatReader();
      reader.decodeFromVideoElement(videoRef.current!, (result) => {
        if (result) {
          setTestScanResult(`✅ Camera: ${result.getText()}`);
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null; setCameraActive(false); reader.reset();
        }
      });
    } catch { setTestScanResult('❌ Camera: ບໍ່ສາມາດເຂົ້າເຖິງໄດ້'); }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ຕັ້ງຄ່າລະບົບ</h1>
            <p className="text-sm text-gray-400 mt-0.5">Printer, VAT & Scanner</p>
          </div>
          <button onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
            {saved ? '✓ ບັນທຶກແລ້ວ' : 'ບັນທຶກ'}
          </button>
        </div>

        {/* Store info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-800">🏪 ຂໍ້ມູນຮ້ານ</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">ຊື່ຮ້ານ</label>
              <input type="text" value={settings.storeName} onChange={(e) => update('storeName', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ເບີໂທ</label>
                <input type="text" value={settings.storePhone} onChange={(e) => update('storePhone', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ທີ່ຢູ່</label>
                <input type="text" value={settings.storeAddress} onChange={(e) => update('storeAddress', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
              </div>
            </div>
          </div>
        </div>

        {/* ⭐ VAT Settings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-800">🧾 ຕັ້ງຄ່າ VAT</h2>
          </div>
          <div className="px-5 py-4 space-y-4">

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">ເປີດໃຊ້ VAT</p>
                <p className="text-xs text-gray-400 mt-0.5">ສະແດງ VAT ໃນໃບເກັບເງິນ</p>
              </div>
              <button onClick={() => updateVAT('enabled', !vat.enabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${vat.enabled ? 'bg-gray-900' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${vat.enabled ? 'left-7' : 'left-1'}`}/>
              </button>
            </div>

            {vat.enabled && (
              <>
                {/* VAT Rate */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ອັດຕາ VAT (%)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={0} max={100} value={vat.rate}
                      onChange={(e) => updateVAT('rate', Number(e.target.value))}
                      className="w-32 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"/>
                    <span className="text-sm text-gray-500">%</span>
                    {/* Quick presets */}
                    <div className="flex gap-1.5">
                      {[7, 10, 15].map((r) => (
                        <button key={r} onClick={() => updateVAT('rate', r)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                            ${vat.rate === r ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                          {r}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* VAT Mode */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">ວິທີຄິດ VAT</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'exclusive', label: 'Exclusive', desc: 'ບວກ VAT ຕ່າງຫາກ', example: '100,000 + 10% = 110,000 ₭' },
                      { id: 'inclusive', label: 'Inclusive', desc: 'ລາຄາລວມ VAT ແລ້ວ', example: '110,000 ₭ (VAT 10% = 10,000)' },
                    ].map((m) => (
                      <button key={m.id} onClick={() => updateVAT('mode', m.id)}
                        className={`py-3 px-4 rounded-xl border text-left transition-all
                          ${vat.mode === m.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className={`text-xs mt-0.5 ${vat.mode === m.id ? 'text-gray-300' : 'text-gray-400'}`}>{m.desc}</p>
                        <p className={`text-xs mt-1 font-mono ${vat.mode === m.id ? 'text-gray-400' : 'text-gray-300'}`}>{m.example}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-medium text-gray-600 mb-2">ຕົວຢ່າງ (ຍອດ 100,000 ₭)</p>
                  {vat.mode === 'exclusive' ? (
                    <>
                      <div className="flex justify-between text-xs text-gray-500"><span>ກ່ອນ VAT</span><span>100,000 ₭</span></div>
                      <div className="flex justify-between text-xs text-blue-600"><span>VAT {vat.rate}%</span><span>+{(100000 * vat.rate / 100).toLocaleString()} ₭</span></div>
                      <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1 border-t border-gray-200"><span>ລວມທັງໝົດ</span><span>{(100000 + 100000 * vat.rate / 100).toLocaleString()} ₭</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs text-gray-500"><span>ລາຄາ (ລວມ VAT)</span><span>100,000 ₭</span></div>
                      <div className="flex justify-between text-xs text-blue-600"><span>VAT {vat.rate}% (ລວມຢູ່ແລ້ວ)</span><span>{Math.round(100000 - 100000 / (1 + vat.rate / 100)).toLocaleString()} ₭</span></div>
                      <div className="flex justify-between text-xs text-gray-500"><span>ກ່ອນ VAT</span><span>{Math.round(100000 / (1 + vat.rate / 100)).toLocaleString()} ₭</span></div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Printer settings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-800">🖨️ ຕັ້ງຄ່າ Printer</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">ປະເພດ Printer</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: 'thermal_usb', label: 'USB/Serial' }, { id: 'thermal_network', label: 'Network (IP)' }, { id: 'both', label: 'ທັງສອງ' }].map((t) => (
                  <button key={t.id} onClick={() => update('printerType', t.id)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                      ${settings.printerType === t.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">ຂະໜາດກະດາດ</label>
              <div className="grid grid-cols-2 gap-2">
                {['58mm', '80mm'].map((w) => (
                  <button key={w} onClick={() => update('printerWidth', w)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                      ${settings.printerWidth === w ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">✂️ Auto Cut</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'full', label: 'Full Cut', desc: 'ຕັດຂາດ' },
                  { id: 'partial', label: 'Partial', desc: 'ຕັດບໍ່ຂາດ' },
                  { id: 'none', label: 'ບໍ່ຕັດ', desc: 'Manual' },
                ].map((c) => (
                  <button key={c.id} onClick={() => update('cutMode', c.id)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all text-center
                      ${settings.cutMode === c.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <div>{c.label}</div>
                    <div className={`text-xs mt-0.5 ${settings.cutMode === c.id ? 'text-gray-300' : 'text-gray-400'}`}>{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {(settings.printerType === 'thermal_network' || settings.printerType === 'both') && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-600">Network Printer (IP)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1.5">IP Address</label>
                    <input type="text" value={settings.printerNetworkIP} onChange={(e) => update('printerNetworkIP', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-gray-400 bg-white"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Port</label>
                    <input type="text" value={settings.printerNetworkPort} onChange={(e) => update('printerNetworkPort', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-gray-400 bg-white"/>
                  </div>
                </div>
              </div>
            )}

            {(settings.printerType === 'thermal_usb' || settings.printerType === 'both') && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-gray-600">USB/Serial Printer</p>
                <button onClick={handleConnectUSB}
                  className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2
                    ${usbConnected ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  <span className={`w-2 h-2 rounded-full ${usbConnected ? 'bg-green-500' : 'bg-gray-300'}`}/>
                  {usbConnected ? 'ເຊື່ອມຕໍ່ແລ້ວ — ຕັດ' : 'ເຊື່ອມ USB Printer'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-gray-700">ພິມ ESC/POS ອັດຕະໂນມັດ</p>
                <p className="text-xs text-gray-400 mt-0.5">ສົ່ງຄຳສັ່ງ printer ທັນທີຫຼັງຊຳລະ</p>
              </div>
              <button onClick={() => update('autoPrint', !settings.autoPrint)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoPrint ? 'bg-gray-900' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.autoPrint ? 'left-7' : 'left-1'}`}/>
              </button>
            </div>

            {testResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {testResult.msg}
              </div>
            )}

            <button onClick={handleTestPrint}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4H7v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/>
              </svg>
              ທົດສອບ ESC/POS + Auto Cut
            </button>
          </div>
        </div>

        {/* Barcode Scanner */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-800">📷 ຕັ້ງຄ່າ Barcode Scanner</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">ປະເພດ Scanner</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: 'usb', label: 'USB/BT' }, { id: 'camera', label: 'Camera' }, { id: 'both', label: 'ທັງສອງ' }].map((t) => (
                  <button key={t.id} onClick={() => update('scannerType', t.id)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                      ${settings.scannerType === t.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {(settings.scannerType === 'usb' || settings.scannerType === 'both') && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-blue-700">USB/Bluetooth Scanner</p>
                <div>
                  <label className="block text-xs text-blue-500 mb-1.5">Scan delay: {settings.scannerDelay}ms</label>
                  <input type="range" min={50} max={300} step={10} value={settings.scannerDelay}
                    onChange={(e) => update('scannerDelay', Number(e.target.value))} className="w-full"/>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-600">ທົດສອບ USB Scanner</p>
                  <button onClick={() => { setScannerActive(!scannerActive); setTestScanResult(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${scannerActive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {scannerActive ? 'ຢຸດ' : 'ເລີ່ມ'}
                  </button>
                </div>
                {scannerActive && (
                  <div className="bg-white rounded-lg px-3 py-2 border border-blue-200 text-xs text-blue-500 animate-pulse">
                    ກຳລັງລໍຖ້າ... ສະແກນ barcode ໄດ້ເລີຍ
                  </div>
                )}
              </div>
            )}

            {(settings.scannerType === 'camera' || settings.scannerType === 'both') && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-600">Camera Scanner</p>
                <button onClick={handleTestCamera}
                  className={`w-full py-2 rounded-lg border text-sm font-medium transition-all
                    ${cameraActive ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {cameraActive ? '🔴 ປິດ Camera' : '📷 ທົດສອບ Camera'}
                </button>
                <video ref={videoRef} className={`w-full rounded-lg ${cameraActive ? 'block' : 'hidden'}`} muted playsInline/>
              </div>
            )}

            {testScanResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium
                ${testScanResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {testScanResult}
              </div>
            )}
          </div>
        </div>

        <button onClick={handleSave}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-all
            ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
          {saved ? '✓ ບັນທຶກແລ້ວ' : 'ບັນທຶກການຕັ້ງຄ່າ'}
        </button>
      </div>
    </div>
  );
}
