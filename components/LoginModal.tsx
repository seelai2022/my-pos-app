'use client';

import { useState } from 'react';
import { supabase, type Staff } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface LoginModalProps {
  onClose?: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePin = (digit: string) => {
    if (loading) return;
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');
    if (newPin.length === 4) {
      setTimeout(() => tryLogin(newPin), 150);
    }
  };

  const tryLogin = async (p: string) => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('staff')
        .select('*')
        .eq('pin', p)
        .eq('active', true)
        .single();

      if (err || !data) {
        setError('PIN ບໍ່ຖືກຕ້ອງ');
        setPin('');
      } else {
        login(data as Staff);
        onClose?.();
      }
    } catch (e) {
      setError('ເຊື່ອມຕໍ່ບໍ່ໄດ້ — ລອງໃໝ່');
      setPin('');
    }
    setLoading(false);
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/95 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">ເຂົ້າສູ່ລະບົບ</h2>
          <p className="text-sm text-gray-400 mt-1">ກະລຸນາໃສ່ PIN ຂອງທ່ານ</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 py-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-150
              ${i < pin.length ? 'bg-gray-900 scale-110' : 'bg-gray-200'}`}/>
          ))}
        </div>

        {/* Loading / Error */}
        {loading && (
          <p className="text-center text-sm text-gray-400 mb-2 animate-pulse">ກຳລັງກວດສອບ...</p>
        )}
        {error && !loading && (
          <p className="text-center text-sm text-red-500 mb-2">{error}</p>
        )}

        {/* Numpad */}
        <div className="px-8 pb-8 grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <button key={n} onClick={() => handlePin(String(n))}
              disabled={loading}
              className="h-14 rounded-2xl bg-gray-50 text-xl font-medium text-gray-800
                         hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50">
              {n}
            </button>
          ))}
          <div/>
          <button onClick={() => handlePin('0')} disabled={loading}
            className="h-14 rounded-2xl bg-gray-50 text-xl font-medium text-gray-800
                       hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50">
            0
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="h-14 rounded-2xl bg-gray-50 text-gray-500
                       hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 0 0 1.414.586H19a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-8.172a2 2 0 0 0-1.414.586L3 12z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
