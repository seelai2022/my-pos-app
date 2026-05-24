import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'POS System',
  description: 'ລະບົບຂາຍໜ້າຮ້ານ',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS System',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111827',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="mobile-web-app-capable" content="yes"/>
      </head>
      <body className="h-full flex bg-gray-50">
        <AuthProvider>
          <PWARegister />
          <Sidebar />
          <main className="flex-1 min-w-0 flex overflow-hidden">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
