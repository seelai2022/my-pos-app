'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'ຂາຍ',
    icon: (active: boolean) => (
      <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h13M10 19a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm7 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/>
      </svg>
    ),
  },
  {
    href: '/products',
    label: 'ສິນຄ້າ',
    icon: (active: boolean) => (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-8-4v4M8 3v4m8-4v4"/>
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'ອໍເດີ',
    icon: (active: boolean) => (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Report',
    icon: (active: boolean) => (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
      </svg>
    ),
  },
  {
    href: '/quotations',
    label: 'ໃບສະເໜີ',
    icon: (active: boolean) => (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
      </svg>
    ),
  },
];

const MORE_ITEMS = [
  { href: '/promotions', label: 'ໂປໂມ', adminOnly: false },
  { href: '/staff', label: 'ພະນັກ', adminOnly: true },
  { href: '/settings', label: 'ຕັ້ງຄ່າ', adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { staff, logout } = useAuth();

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <nav className="hidden md:flex w-44 shrink-0 bg-white border-r border-gray-100 flex-col py-5 shadow-sm">
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-800">POS System</span>
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {[...NAV_ITEMS, ...MORE_ITEMS.filter(i => !i.adminOnly || staff?.role === 'admin')].map((item) => {
            const isActive = pathname === item.href;
            const icon = 'icon' in item ? (item as typeof NAV_ITEMS[0]).icon(isActive) : null;
            return (
              <a key={item.href} href={item.href}
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${isActive ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
                {icon}
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
        {staff && (
          <div className="mx-2 mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 mb-1">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0
                ${staff.role === 'admin' ? 'bg-gray-900' : 'bg-blue-500'}`}>
                {staff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{staff.name}</p>
                <p className="text-xs text-gray-400">{staff.role === 'admin' ? 'Admin' : 'Cashier'}</p>
              </div>
            </div>
            <button onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1"/>
              </svg>
              ອອກ
            </button>
          </div>
        )}
      </nav>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-14">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a key={item.href} href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 transition-colors
                  ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                <div className={`p-1 rounded-lg transition-all ${isActive ? 'bg-gray-900 text-white' : ''}`}>
                  {item.icon(isActive)}
                </div>
                <span className={`text-xs mt-0.5 font-medium leading-none ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </a>
            );
          })}
          {/* Profile/Logout */}
          <button onClick={logout}
            className="flex-1 flex flex-col items-center justify-center py-1 px-0.5 text-gray-400">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold
              ${staff?.role === 'admin' ? 'bg-gray-700' : 'bg-blue-400'}`}>
              {staff?.name.charAt(0) ?? '?'}
            </div>
            <span className="text-xs mt-0.5 font-medium leading-none text-gray-400">
              {staff?.name.split(' ')[0] ?? 'ອອກ'}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
