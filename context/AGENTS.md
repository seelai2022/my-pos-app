'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Staff } from '@/lib/supabase';

interface AuthContextType {
  staff: Staff | null;
  login: (staff: Staff) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  staff: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pos_staff');
    if (saved) setStaff(JSON.parse(saved));
  }, []);

  const login = (s: Staff) => {
    setStaff(s);
    localStorage.setItem('pos_staff', JSON.stringify(s));
  };

  const logout = () => {
    setStaff(null);
    localStorage.removeItem('pos_staff');
  };

  return (
    <AuthContext.Provider value={{ staff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
